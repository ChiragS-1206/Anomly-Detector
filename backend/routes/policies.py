"""
Policy Engine - Check network logs against defined policies
"""

from flask import Blueprint, request, jsonify, session
import mysql.connector
from config import Config
from functools import wraps

policies_bp = Blueprint("policies", __name__, url_prefix="/api/policies")

def get_db():
    return mysql.connector.connect(
        host=Config.DB_HOST, user=Config.DB_USER,
        password=Config.DB_PASSWORD, database=Config.DB_NAME,
        # port=Config.DB_PORT
    )

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "admin_id" not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

# ── Core Policy Checker ─────────────────────────────
def check_policies(log):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM policies WHERE is_active = TRUE")
    policies = cursor.fetchall()
    violations = []

    for policy in policies:
        rule_type   = policy["rule_type"]
        rule_value  = policy["rule_value"]
        violated    = False
        description = ""

        if rule_type == "BLOCK_PORT":
            if str(log.get("dest_port")) == str(rule_value):
                violated    = True
                description = f"Policy violated: {policy['name']} — connection to port {rule_value} detected from {log.get('source_ip')}"

        elif rule_type == "MAX_BYTES":
            if log.get("bytes_sent", 0) > int(rule_value):
                violated    = True
                description = f"Policy violated: {policy['name']} — {log.get('bytes_sent')} bytes sent (limit: {rule_value})"

        elif rule_type == "MAX_PACKETS":
            if log.get("packets", 0) > int(rule_value):
                violated    = True
                description = f"Policy violated: {policy['name']} — {log.get('packets')} packets detected (limit: {rule_value})"

        elif rule_type == "AFTER_HOURS":
            from datetime import datetime
            current_hour = datetime.now().hour
            if current_hour >= int(rule_value) or current_hour < 6:
                violated    = True
                description = f"Policy violated: {policy['name']} — network activity detected at {current_hour}:00"

        elif rule_type == "PORT_SCAN":
            cursor2 = conn.cursor(dictionary=True)
            cursor2.execute("""
                SELECT COUNT(DISTINCT dest_port) as port_count
                FROM network_logs
                WHERE source_ip = %s
                AND timestamp >= NOW() - INTERVAL 60 SECOND
            """, (log.get("source_ip"),))
            result = cursor2.fetchone()
            cursor2.close()
            if result and result["port_count"] >= int(rule_value):
                violated    = True
                description = f"Policy violated: {policy['name']} — {result['port_count']} ports scanned by {log.get('source_ip')} in 60 seconds"

        if violated:
            violations.append({
                "policy_id":   policy["id"],
                "policy_name": policy["name"],
                "severity":    policy["severity"],
                "description": description
            })

    cursor.close()
    conn.close()
    return violations


def save_violations(log_id, log, violations):
    if not violations:
        return
    conn = get_db()
    cursor = conn.cursor()
    for v in violations:
        cursor.execute("""
            INSERT INTO policy_violations
            (policy_id, log_id, source_ip, dest_ip, dest_port, description)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            v["policy_id"], log_id,
            log.get("source_ip"), log.get("dest_ip"),
            log.get("dest_port"), v["description"]
        ))
    conn.commit()
    cursor.close()
    conn.close()


# ════════════════════════════════════════════════════
# ROUTES — Fixed order (specific before dynamic)
# ════════════════════════════════════════════════════

# 1 ── GET all policies
@policies_bp.route("/", methods=["GET"])
@require_auth
def get_policies():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM policies ORDER BY severity DESC")
    policies = cursor.fetchall()
    for p in policies:
        p["created_at"] = p["created_at"].isoformat()
    cursor.close()
    conn.close()
    return jsonify({"policies": policies})


# 2 ── POST create policy
@policies_bp.route("/", methods=["POST"])
@require_auth
def create_policy():
    data = request.get_json()
    required = ["name", "rule_type", "rule_value", "severity"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing required fields"}), 400
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO policies (name, description, rule_type, rule_value, severity)
        VALUES (%s, %s, %s, %s, %s)
    """, (
        data["name"], data.get("description", ""),
        data["rule_type"], data["rule_value"], data["severity"]
    ))
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return jsonify({"message": "Policy created", "id": new_id}), 201


# 3 ── GET compliance score ← MUST BE BEFORE /<int:policy_id>
@policies_bp.route("/compliance-score", methods=["GET"])
@require_auth
def compliance_score():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT COUNT(*) as total FROM network_logs
        WHERE timestamp >= NOW() - INTERVAL 7 DAY
    """)
    total_logs = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT COUNT(*) as total FROM policy_violations
        WHERE timestamp >= NOW() - INTERVAL 7 DAY
    """)
    total_violations = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT p.severity, COUNT(*) as count
        FROM policy_violations pv
        JOIN policies p ON pv.policy_id = p.id
        WHERE pv.timestamp >= NOW() - INTERVAL 7 DAY
        GROUP BY p.severity
    """)
    by_severity = cursor.fetchall()

    cursor.execute("""
        SELECT DATE(pv.timestamp) as date,
               COUNT(*) as violations,
               p.severity
        FROM policy_violations pv
        JOIN policies p ON pv.policy_id = p.id
        WHERE pv.timestamp >= NOW() - INTERVAL 7 DAY
        GROUP BY DATE(pv.timestamp), p.severity
        ORDER BY date ASC
    """)
    daily = cursor.fetchall()
    for d in daily:
        d["date"] = str(d["date"])

    cursor.execute("""
        SELECT p.id, p.name, p.severity, p.is_active,
               COUNT(pv.id) as violation_count
        FROM policies p
        LEFT JOIN policy_violations pv
            ON p.id = pv.policy_id
            AND pv.timestamp >= NOW() - INTERVAL 7 DAY
        GROUP BY p.id
        ORDER BY violation_count DESC
    """)
    per_policy = cursor.fetchall()

    cursor.execute("""
        SELECT
            SUM(is_resolved = TRUE)  as resolved,
            SUM(is_resolved = FALSE) as unresolved
        FROM policy_violations
        WHERE timestamp >= NOW() - INTERVAL 7 DAY
    """)
    resolution = cursor.fetchone()

    cursor.close()
    conn.close()

    score = 100.0
    severity_weights = {
        "CRITICAL": 5.0,
        "HIGH":     3.0,
        "MEDIUM":   1.5,
        "LOW":      0.5
    }
    for s in by_severity:
        weight    = severity_weights.get(s["severity"], 1.0)
        deduction = min(s["count"] * weight, 30)
        score    -= deduction

    score  = max(0.0, round(score, 1))
    status = "GOOD" if score >= 80 else "WARNING" if score >= 60 else "CRITICAL"

    return jsonify({
        "score":            score,
        "status":           status,
        "total_logs":       total_logs,
        "total_violations": total_violations,
        "by_severity":      by_severity,
        "daily_violations": daily,
        "per_policy":       per_policy,
        "resolved":         resolution["resolved"] or 0,
        "unresolved":       resolution["unresolved"] or 0,
    })


# 4 ── GET violations
@policies_bp.route("/violations", methods=["GET"])
@require_auth
def get_violations():
    page   = int(request.args.get("page", 1))
    limit  = min(int(request.args.get("limit", 30)), 100)
    offset = (page - 1) * limit
    conn   = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT COUNT(*) as total FROM policy_violations")
    total = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT pv.*, p.name as policy_name, p.severity
        FROM policy_violations pv
        JOIN policies p ON pv.policy_id = p.id
        ORDER BY pv.timestamp DESC
        LIMIT %s OFFSET %s
    """, (limit, offset))
    violations = cursor.fetchall()
    for v in violations:
        v["timestamp"] = v["timestamp"].isoformat()

    cursor.close()
    conn.close()
    return jsonify({"violations": violations, "total": total})


# 5 ── GET violations summary
@policies_bp.route("/violations/summary", methods=["GET"])
@require_auth
def violations_summary():
    conn   = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT COUNT(*) as total FROM policy_violations")
    total = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as unresolved FROM policy_violations WHERE is_resolved = FALSE")
    unresolved = cursor.fetchone()["unresolved"]

    cursor.execute("""
        SELECT p.name, p.severity, COUNT(*) as count
        FROM policy_violations pv
        JOIN policies p ON pv.policy_id = p.id
        GROUP BY p.id
        ORDER BY count DESC
        LIMIT 5
    """)
    top_violated = cursor.fetchall()

    cursor.close()
    conn.close()
    return jsonify({
        "total":        total,
        "unresolved":   unresolved,
        "top_violated": top_violated
    })


# 6 ── PATCH resolve violation
@policies_bp.route("/violations/<int:v_id>/resolve", methods=["PATCH"])
@require_auth
def resolve_violation(v_id):
    conn   = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE policy_violations SET is_resolved = TRUE WHERE id = %s", (v_id,)
    )
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": f"Violation {v_id} resolved"})


# 7 ── PATCH toggle policy  ← dynamic routes LAST
@policies_bp.route("/<int:policy_id>/toggle", methods=["PATCH"])
@require_auth
def toggle_policy(policy_id):
    conn   = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE policies SET is_active = NOT is_active WHERE id = %s",
        (policy_id,)
    )
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": f"Policy {policy_id} toggled"})


# 8 ── DELETE policy  ← ALWAYS LAST
@policies_bp.route("/<int:policy_id>", methods=["DELETE"])
@require_auth
def delete_policy(policy_id):
    conn   = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM policies WHERE id = %s", (policy_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": f"Policy {policy_id} deleted"})