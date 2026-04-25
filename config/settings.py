import os

UPLOAD_FOLDER = "uploads"


def configure_app(app):
    app.secret_key = "secret_key_123"
    app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024
    app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = False

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
