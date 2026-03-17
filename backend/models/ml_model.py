"""
ML Engine - Isolation Forest Anomaly Detection
Uses scikit-learn's IsolationForest to detect suspicious network activity
"""

import numpy as np
import pickle
import os
import mysql.connector
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

MODEL_PATH = "models/isolation_forest.pkl"
SCALER_PATH = "models/scaler.pkl"

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "network_monitor"
}

# ── Feature extraction ──────────────────────────────
def extract_features(logs):
    """
    Convert raw log rows into feature matrix.
    Features: bytes_sent, packets, duration_ms, dest_port, source_port, protocol_enc
    """
    protocol_map = {"TCP": 0, "UDP": 1, "ICMP": 2}
    features = []
    for log in logs:
        protocol_enc = protocol_map.get(log["protocol"], 0)
        features.append([
            log["bytes_sent"],
            log["packets"],
            log["duration_ms"],
            log["dest_port"],
            log["source_port"],
            protocol_enc,
            log["bytes_sent"] / max(log["duration_ms"], 1),    # bytes/ms rate
            log["packets"]    / max(log["duration_ms"], 1),    # pps rate
        ])
    return np.array(features)

# ── Training ────────────────────────────────────────
def train_model():
    """Train IsolationForest on recent NORMAL traffic logs."""
    print("📊 Fetching training data from DB...")
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)

    # Use normal traffic for training (unsupervised baseline)
    cursor.execute("""
        SELECT bytes_sent, packets, duration_ms, dest_port, source_port, protocol
        FROM network_logs
        ORDER BY timestamp DESC
        LIMIT 5000
    """)
    logs = cursor.fetchall()
    cursor.close()
    conn.close()

    if len(logs) < 100:
        print("⚠️  Need at least 100 logs to train. Generate more data first.")
        return None, None

    X = extract_features(logs)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # contamination = expected % of anomalies (15% based on our generator)
    model = IsolationForest(
        n_estimators=100,
        contamination=0.15,
        max_samples="auto",
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_scaled)

    os.makedirs("models", exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    with open(SCALER_PATH, "wb") as f:
        pickle.dump(scaler, f)

    print(f"✅ Model trained on {len(logs)} logs and saved.")
    return model, scaler

# ── Prediction ──────────────────────────────────────
def load_model():
    if not os.path.exists(MODEL_PATH):
        print("⚠️  No model found. Training now...")
        return train_model()
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
    with open(SCALER_PATH, "rb") as f:
        scaler = pickle.load(f)
    return model, scaler

def predict_anomaly(log_dict):
    """
    Predict if a single log entry is anomalous.
    Returns: (is_anomaly: bool, score: float)
    """
    model, scaler = load_model()
    if model is None:
        return False, 0.0

    X = extract_features([log_dict])
    X_scaled = scaler.transform(X)

    # IsolationForest: -1 = anomaly, 1 = normal
    prediction = model.predict(X_scaled)[0]
    # decision_function: more negative = more anomalous
    score = model.decision_function(X_scaled)[0]
    # Normalize score to 0..1 where 1 = most anomalous
    normalized_score = float(np.clip(-score, 0, 1))

    is_anomaly = prediction == -1
    return is_anomaly, round(normalized_score, 4)

def predict_batch(logs):
    """
    Predict anomalies on a list of log dicts.
    Returns list of (is_anomaly, score) tuples.
    """
    model, scaler = load_model()
    if model is None or not logs:
        return [(False, 0.0)] * len(logs)

    X = extract_features(logs)
    X_scaled = scaler.transform(X)

    predictions = model.predict(X_scaled)
    scores = model.decision_function(X_scaled)
    normalized = np.clip(-scores, 0, 1)

    return [(predictions[i] == -1, round(float(normalized[i]), 4)) for i in range(len(logs))]

# ── Retrain on latest data ──────────────────────────
def retrain():
    print("🔄 Retraining model on latest data...")
    model, scaler = train_model()
    if model:
        print("✅ Model retrained successfully.")
    return model is not None

def get_model_metrics():
    """
    Calculate ML model performance metrics
    using labeled data from DB
    """
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)

    # Fetch logs that have ground truth labels
    cursor.execute("""
        SELECT bytes_sent, packets, duration_ms,
               dest_port, source_port, protocol,
               is_anomaly, anomaly_score
        FROM network_logs
        ORDER BY timestamp DESC
        LIMIT 1000
    """)
    logs = cursor.fetchall()
    cursor.close()
    conn.close()

    if len(logs) < 50:
        return None

    model, scaler = load_model()
    if model is None:
        return None

    # Ground truth labels
    y_true = [1 if log["is_anomaly"] else 0 for log in logs]

    # Model predictions
    X = extract_features(logs)
    X_scaled = scaler.transform(X)
    predictions = model.predict(X_scaled)
    y_pred = [1 if p == -1 else 0 for p in predictions]

    # Calculate metrics manually
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)

    total     = len(y_true)
    accuracy  = round((tp + tn) / total * 100, 2)         if total > 0          else 0
    precision = round(tp / (tp + fp) * 100, 2)            if (tp + fp) > 0      else 0
    recall    = round(tp / (tp + fn) * 100, 2)            if (tp + fn) > 0      else 0
    f1        = round(2 * precision * recall /
                     (precision + recall), 2)              if (precision + recall) > 0 else 0
    fpr       = round(fp / (fp + tn) * 100, 2)            if (fp + tn) > 0      else 0

    return {
        "accuracy":         accuracy,
        "precision":        precision,
        "recall":           recall,
        "f1_score":         f1,
        "false_positive_rate": fpr,
        "confusion_matrix": {
            "true_positive":  tp,
            "true_negative":  tn,
            "false_positive": fp,
            "false_negative": fn
        },
        "total_samples":    total,
        "anomaly_count":    sum(y_true),
        "normal_count":     total - sum(y_true)
    }

if __name__ == "__main__":
    # Run standalone to train model
    train_model()