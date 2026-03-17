"""
Logs routes - Fetch, filter, and analyze network logs
"""

from flask import Blueprint, request, jsonify, session
import mysql.connector
from config import Config
from models.ml_model import predict_anomaly
from models.ml_model import predict_anomaly, get_model_metrics

logs_bp = Blueprint("logs", __name__, url_prefix="/api/logs")

def get_db():
    return mysql.connector.connect(
        host=Config.DB_HOST, user=Config.DB_USER,
        password=Config.DB_PASSWORD, database=Config.DB_NAME
    )

def require_auth(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if "admin_id" not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

@logs_bp.route("/", methods=["GET"])
@require_auth
def get_logs():
    """
    GET /api/logs/?page=1&limit=50&flag=CRITICAL&protocol=TCP
    """
    page     = int(request.args.get("page", 1))
    limit    = min(int(request.args.get("limit", 50)), 200)
    flag     = request.args.get("flag", None)
    protocol = request.args.get("protocol", None)
    offset   = (page - 1) * limit

    conditions = []
    params = []
    if flag:
        conditions.append("flag = %s")
        params.append(flag)
    if protocol:
        conditions.append("protocol = %s")
        params.append(protocol)

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(f"SELECT COUNT(*) as total FROM network_logs {where_clause}", params)
    total = cursor.fetchone()["total"]

    query = f"""
        SELECT * FROM network_logs
        {where_clause}
        ORDER BY timestamp DESC
        LIMIT %s OFFSET %s
    """
    cursor.execute(query, params + [limit, offset])
    logs = cursor.fetchall()

    # Convert datetime to string
    for log in logs:
        log["timestamp"] = log["timestamp"].isoformat()

    cursor.close()
    conn.close()

    return jsonify({
        "logs": logs,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    })

@logs_bp.route("/stats", methods=["GET"])
@require_auth
def get_stats():
    """Summary stats for dashboard cards"""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    # Total logs
    cursor.execute("SELECT COUNT(*) as total FROM network_logs")
    total = cursor.fetchone()["total"]

    # Anomaly count
    cursor.execute("SELECT COUNT(*) as cnt FROM network_logs WHERE is_anomaly = 1")
    anomalies = cursor.fetchone()["cnt"]

    # Critical count
    cursor.execute("SELECT COUNT(*) as cnt FROM network_logs WHERE flag = 'CRITICAL'")
    critical = cursor.fetchone()["cnt"]

    # Logs per hour (last 24h)
    cursor.execute("""
        SELECT HOUR(timestamp) as hour, COUNT(*) as count
        FROM network_logs
        WHERE timestamp >= NOW() - INTERVAL 24 HOUR
        GROUP BY HOUR(timestamp)
        ORDER BY hour
    """)
    hourly = cursor.fetchall()

    # Top source IPs (anomalous)
    cursor.execute("""
        SELECT source_ip, COUNT(*) as count
        FROM network_logs
        WHERE is_anomaly = 1
        GROUP BY source_ip
        ORDER BY count DESC
        LIMIT 5
    """)
    top_ips = cursor.fetchall()

    # Protocol breakdown
    cursor.execute("""
        SELECT protocol, COUNT(*) as count
        FROM network_logs
        GROUP BY protocol
    """)
    protocols = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify({
        "total_logs":       total,
        "total_anomalies":  anomalies,
        "critical_count":   critical,
        "normal_count":     total - anomalies,
        "anomaly_rate":     round(anomalies / max(total, 1) * 100, 1),
        "hourly_traffic":   hourly,
        "top_attacker_ips": top_ips,
        "protocol_breakdown": protocols
    })

@logs_bp.route("/analyze", methods=["POST"])
@require_auth
def analyze_log():
    """Run ML prediction on a single log entry"""
    data = request.get_json()
    is_anomaly, score = predict_anomaly(data)
    return jsonify({
        "is_anomaly": is_anomaly,
        "anomaly_score": score,
        "flag": "CRITICAL" if score > 0.7 else "SUSPICIOUS" if is_anomaly else "NORMAL"
    })

@logs_bp.route("/recent", methods=["GET"])
@require_auth
def recent_logs():
    """Last 20 logs for live feed"""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM network_logs ORDER BY timestamp DESC LIMIT 20")
    logs = cursor.fetchall()
    for log in logs:
        log["timestamp"] = log["timestamp"].isoformat()
    cursor.close()
    conn.close()
    return jsonify({"logs": logs})


@logs_bp.route("/ml-metrics", methods=["GET"])
@require_auth
def ml_metrics():
    """Get ML model performance metrics"""
    metrics = get_model_metrics()
    if metrics is None:
        return jsonify({
            "error": "Not enough data or model not trained yet"
        }), 404
    return jsonify(metrics)