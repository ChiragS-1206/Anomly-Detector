"""
Alerts routes - Manage security alerts
"""

from flask import Blueprint, request, jsonify, session
import mysql.connector
from config import Config
from functools import wraps

alerts_bp = Blueprint("alerts", __name__, url_prefix="/api/alerts")

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

@alerts_bp.route("/", methods=["GET"])
@require_auth
def get_alerts():
    severity    = request.args.get("severity", None)
    resolved    = request.args.get("resolved", None)
    page        = int(request.args.get("page", 1))
    limit       = min(int(request.args.get("limit", 30)), 100)
    offset      = (page - 1) * limit

    conditions = []
    params = []
    if severity:
        conditions.append("severity = %s")
        params.append(severity)
    if resolved is not None:
        conditions.append("is_resolved = %s")
        params.append(resolved == "true")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(f"SELECT COUNT(*) as total FROM alerts {where}", params)
    total = cursor.fetchone()["total"]

    cursor.execute(
        f"SELECT * FROM alerts {where} ORDER BY timestamp DESC LIMIT %s OFFSET %s",
        params + [limit, offset]
    )
    alerts = cursor.fetchall()
    for a in alerts:
        a["timestamp"] = a["timestamp"].isoformat()

    cursor.close()
    conn.close()

    return jsonify({"alerts": alerts, "total": total, "page": page})

@alerts_bp.route("/<int:alert_id>/resolve", methods=["PATCH"])
@require_auth
def resolve_alert(alert_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE alerts SET is_resolved = TRUE WHERE id = %s", (alert_id,))
    conn.commit()
    affected = cursor.rowcount
    cursor.close()
    conn.close()
    if affected == 0:
        return jsonify({"error": "Alert not found"}), 404
    return jsonify({"message": f"Alert {alert_id} resolved"})

@alerts_bp.route("/summary", methods=["GET"])
@require_auth
def alert_summary():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT severity, COUNT(*) as count
        FROM alerts WHERE is_resolved = FALSE
        GROUP BY severity
    """)
    by_severity = cursor.fetchall()

    cursor.execute("""
        SELECT alert_type, COUNT(*) as count
        FROM alerts
        GROUP BY alert_type
        ORDER BY count DESC
    """)
    by_type = cursor.fetchall()

    cursor.execute("SELECT COUNT(*) as cnt FROM alerts WHERE is_resolved = FALSE")
    unresolved = cursor.fetchone()["cnt"]

    cursor.close()
    conn.close()
    return jsonify({
        "unresolved": unresolved,
        "by_severity": by_severity,
        "by_type": by_type
    })