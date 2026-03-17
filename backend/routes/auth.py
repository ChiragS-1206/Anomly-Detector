"""
Auth routes - Login / Logout
"""

from flask import Blueprint, request, jsonify, session
from werkzeug.security import check_password_hash, generate_password_hash
import mysql.connector
from config import Config

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

def get_db():
    return mysql.connector.connect(
        host=Config.DB_HOST, user=Config.DB_USER,
        password=Config.DB_PASSWORD, database=Config.DB_NAME,
        # port=Config.DB_PORT
    )

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM admins WHERE username = %s", (username,))
    admin = cursor.fetchone()
    cursor.close()
    conn.close()

    if not admin or not check_password_hash(admin["password_hash"], password):
        return jsonify({"error": "Invalid credentials"}), 401

    session["admin_id"] = admin["id"]
    session["username"] = admin["username"]
    return jsonify({"message": "Login successful", "username": admin["username"]})

@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})

@auth_bp.route("/me", methods=["GET"])
def me():
    if "admin_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    return jsonify({"username": session["username"]})

@auth_bp.route("/setup", methods=["POST"])
def setup_admin():
    """One-time setup to create admin with hashed password"""
    data = request.get_json()
    username = data.get("username", "admin")
    password = data.get("password", "admin123")
    hashed = generate_password_hash(password)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO admins (username, password_hash) VALUES (%s, %s) ON DUPLICATE KEY UPDATE password_hash=%s",
        (username, hashed, hashed)
    )
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": f"Admin '{username}' created/updated"})