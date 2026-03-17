"""
Network Traffic Log Generator
Simulates realistic network traffic + injects anomalies
Run: python log_generator.py
"""

import random
import time
import mysql.connector
from datetime import datetime

# ── DB Config ──────────────────────────────────────
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "network_monitor"
}

# ── IP pools ───────────────────────────────────────
INTERNAL_IPS = [f"192.168.1.{i}" for i in range(2, 50)]
EXTERNAL_IPS = [f"203.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}" for _ in range(20)]
SUSPICIOUS_IPS = ["10.0.0.99", "172.16.0.100", "192.168.1.200"]

COMMON_PORTS = [80, 443, 22, 21, 25, 53, 3306, 8080, 8443]
PROTOCOLS = ["TCP", "UDP", "ICMP"]

# ── Normal traffic generator ────────────────────────
def generate_normal_log():
    return {
        "source_ip":     random.choice(INTERNAL_IPS),
        "dest_ip":       random.choice(EXTERNAL_IPS),
        "source_port":   random.randint(1024, 65535),
        "dest_port":     random.choice(COMMON_PORTS),
        "protocol":      random.choice(["TCP", "UDP"]),
        "bytes_sent":    random.randint(200, 5000),
        "packets":       random.randint(1, 20),
        "duration_ms":   random.randint(10, 500),
        "is_anomaly":    False,
        "anomaly_score": round(random.uniform(-0.8, -0.2), 4),
        "flag":          "NORMAL"
    }

# ── Anomaly generators ──────────────────────────────
def generate_port_scan():
    src = random.choice(SUSPICIOUS_IPS)
    return {
        "source_ip":     src,
        "dest_ip":       random.choice(INTERNAL_IPS),
        "source_port":   random.randint(1024, 65535),
        "dest_port":     random.randint(1, 1024),
        "protocol":      "TCP",
        "bytes_sent":    random.randint(40, 100),
        "packets":       random.randint(100, 500),
        "duration_ms":   random.randint(1, 50),
        "is_anomaly":    True,
        "anomaly_score": round(random.uniform(0.3, 0.9), 4),
        "flag":          "SUSPICIOUS"
    }

def generate_dos_attack():
    return {
        "source_ip":     random.choice(EXTERNAL_IPS),
        "dest_ip":       random.choice(INTERNAL_IPS[:5]),
        "source_port":   random.randint(1024, 65535),
        "dest_port":     80,
        "protocol":      "TCP",
        "bytes_sent":    random.randint(50000, 500000),
        "packets":       random.randint(1000, 10000),
        "duration_ms":   random.randint(100, 1000),
        "is_anomaly":    True,
        "anomaly_score": round(random.uniform(0.6, 1.0), 4),
        "flag":          "CRITICAL"
    }

def generate_data_exfil():
    return {
        "source_ip":     random.choice(INTERNAL_IPS),
        "dest_ip":       random.choice(EXTERNAL_IPS),
        "source_port":   random.randint(1024, 65535),
        "dest_port":     443,
        "protocol":      "TCP",
        "bytes_sent":    random.randint(100000, 1000000),
        "packets":       random.randint(500, 2000),
        "duration_ms":   random.randint(5000, 30000),
        "is_anomaly":    True,
        "anomaly_score": round(random.uniform(0.4, 0.8), 4),
        "flag":          "SUSPICIOUS"
    }

def generate_brute_force():
    return {
        "source_ip":     random.choice(EXTERNAL_IPS),
        "dest_ip":       random.choice(INTERNAL_IPS[:10]),
        "source_port":   random.randint(1024, 65535),
        "dest_port":     22,
        "protocol":      "TCP",
        "bytes_sent":    random.randint(100, 300),
        "packets":       random.randint(50, 200),
        "duration_ms":   random.randint(5, 30),
        "is_anomaly":    True,
        "anomaly_score": round(random.uniform(0.5, 0.85), 4),
        "flag":          "SUSPICIOUS"
    }

# ── DB Insert ───────────────────────────────────────
def insert_log(cursor, log):
    sql = """
        INSERT INTO network_logs
        (source_ip, dest_ip, source_port, dest_port, protocol,
         bytes_sent, packets, duration_ms, is_anomaly, anomaly_score, flag)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    cursor.execute(sql, (
        log["source_ip"], log["dest_ip"],
        log["source_port"], log["dest_port"],
        log["protocol"], log["bytes_sent"],
        log["packets"], log["duration_ms"],
        log["is_anomaly"], log["anomaly_score"],
        log["flag"]
    ))
    return cursor.lastrowid

def insert_alert(cursor, log_id, log):
    if not log["is_anomaly"]:
        return
    alert_types = {
        "SUSPICIOUS": random.choice(["PORT_SCAN", "BRUTE_FORCE", "DATA_EXFIL"]),
        "CRITICAL":   "DOS_ATTACK"
    }
    descriptions = {
        "PORT_SCAN":   f"Port scan detected from {log['source_ip']}",
        "BRUTE_FORCE": f"Brute force attempt on SSH from {log['source_ip']}",
        "DATA_EXFIL":  f"Large data exfiltration: {log['bytes_sent']} bytes",
        "DOS_ATTACK":  f"DoS flood: {log['packets']} packets from {log['source_ip']}"
    }
    alert_type = alert_types.get(log["flag"], "UNKNOWN")
    severity   = "CRITICAL" if log["flag"] == "CRITICAL" else "HIGH" if log["anomaly_score"] > 0.6 else "MEDIUM"
    sql = """
        INSERT INTO alerts (log_id, alert_type, severity, source_ip, description)
        VALUES (%s, %s, %s, %s, %s)
    """
    cursor.execute(sql, (
        log_id, alert_type, severity,
        log["source_ip"], descriptions.get(alert_type, "Anomaly detected")
    ))

# ── Policy Checker (standalone — no Flask import) ───
def check_and_save_violations(conn, log_id, log):
    cursor = conn.cursor(dictionary=True)

    # Fetch all active policies
    cursor.execute("SELECT * FROM policies WHERE is_active = TRUE")
    policies = cursor.fetchall()

    violations = []

    for policy in policies:
        rule_type  = policy["rule_type"]
        rule_value = policy["rule_value"]
        violated   = False
        description = ""

        # Rule 1 — Block specific port
        if rule_type == "BLOCK_PORT":
            if str(log.get("dest_port")) == str(rule_value):
                violated    = True
                description = (f"Policy '{policy['name']}' violated — "
                               f"connection to port {rule_value} from {log.get('source_ip')}")

        # Rule 2 — Max bytes
        elif rule_type == "MAX_BYTES":
            if log.get("bytes_sent", 0) > int(rule_value):
                violated    = True
                description = (f"Policy '{policy['name']}' violated — "
                               f"{log.get('bytes_sent')} bytes sent (limit: {rule_value})")

        # Rule 3 — Max packets
        elif rule_type == "MAX_PACKETS":
            if log.get("packets", 0) > int(rule_value):
                violated    = True
                description = (f"Policy '{policy['name']}' violated — "
                               f"{log.get('packets')} packets (limit: {rule_value})")

        # Rule 4 — After hours
        elif rule_type == "AFTER_HOURS":
            current_hour = datetime.now().hour
            if current_hour >= int(rule_value) or current_hour < 6:
                violated    = True
                description = (f"Policy '{policy['name']}' violated — "
                               f"network activity at {current_hour}:00")

        # Rule 5 — Port scan
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
                description = (f"Policy '{policy['name']}' violated — "
                               f"{result['port_count']} ports scanned by {log.get('source_ip')} in 60s")

        if violated:
            violations.append({
                "policy_id":   policy["id"],
                "policy_name": policy["name"],
                "severity":    policy["severity"],
                "description": description
            })

    # Save violations to DB
    if violations:
        insert_cursor = conn.cursor()
        for v in violations:
            insert_cursor.execute("""
                INSERT INTO policy_violations
                (policy_id, log_id, source_ip, dest_ip, dest_port, description)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                v["policy_id"], log_id,
                log.get("source_ip"), log.get("dest_ip"),
                log.get("dest_port"), v["description"]
            ))
        conn.commit()
        insert_cursor.close()

    cursor.close()
    return violations

# ── Main loop ───────────────────────────────────────
def main():
    print("🔌 Connecting to MySQL...")
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    print("✅ Connected. Generating traffic logs...\n")

    log_count     = 0
    anomaly_count = 0
    violation_count = 0

    anomaly_generators = [
        generate_port_scan,
        generate_dos_attack,
        generate_data_exfil,
        generate_brute_force
    ]

    try:
        while True:
            if random.random() < 0.85:
                log = generate_normal_log()
            else:
                log = random.choice(anomaly_generators)()
                anomaly_count += 1

            log_id = insert_log(cursor, log)
            insert_alert(cursor, log_id, log)
            conn.commit()

            # ── Check policies ──
            violations = check_and_save_violations(conn, log_id, log)
            if violations:
                violation_count += len(violations)
                for v in violations:
                    print(f"  🚫 POLICY VIOLATION: {v['policy_name']} | {v['severity']}")

            log_count += 1
            flag  = log["flag"]
            emoji = "🟢" if flag == "NORMAL" else "🟡" if flag == "SUSPICIOUS" else "🔴"
            print(f"{emoji} [{log_count}] {log['source_ip']} → {log['dest_ip']}:{log['dest_port']} "
                  f"| {flag} | score: {log['anomaly_score']}")

            time.sleep(random.uniform(0.3, 1.0))

    except KeyboardInterrupt:
        print(f"\n⏹ Stopped.")
        print(f"   Total logs:       {log_count}")
        print(f"   Anomalies:        {anomaly_count}")
        print(f"   Policy violations:{violation_count}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main()