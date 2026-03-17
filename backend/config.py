"""
Configuration for Flask app
"""

class Config:
    SECRET_KEY = "change-this-secret-key-in-production"
    DEBUG = True

    # MySQL DB
    DB_HOST     = "localhost"
    DB_USER     = "root"
    DB_PASSWORD = ""         
    DB_NAME     = "network_monitor"

    # CORS
    CORS_ORIGINS = ["http://localhost:5173"]   # React dev server