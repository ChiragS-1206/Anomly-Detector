from flask import Flask
from flask_cors import CORS
from config import Config
from routes.auth import auth_bp
from routes.logs import logs_bp
from routes.alerts import alerts_bp
from routes.policies import policies_bp          # ← ADD THIS

app = Flask(__name__)
app.config.from_object(Config)
app.secret_key = Config.SECRET_KEY

CORS(app,
     origins=["http://localhost:5173"],
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
)

app.register_blueprint(auth_bp)
app.register_blueprint(logs_bp)
app.register_blueprint(alerts_bp)
app.register_blueprint(policies_bp)             # ← ADD THIS

@app.route("/api/health")
def health():
    return {"status": "ok", "service": "Network Anomaly Detector"}

if __name__ == "__main__":
    app.run(debug=True, port=5000)