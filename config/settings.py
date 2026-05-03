import os
from urllib.parse import urlparse

UPLOAD_FOLDER = "uploads"


def _normalize_google_redirect_uri(raw_value):
    default_uri = "http://127.0.0.1:5000/api/auth/google/callback"
    value = (raw_value or "").strip()
    if not value:
        return default_uri

    value = value.rstrip("/")
    callback_path = "/api/auth/google/callback"
    if value.endswith(callback_path):
        return value

    parsed = urlparse(value)
    if parsed.scheme and parsed.netloc and parsed.path in ("", "/"):
        return f"{value}{callback_path}"

    return value


GOOGLE_REDIRECT_URI = _normalize_google_redirect_uri(
    os.environ.get("GOOGLE_REDIRECT_URI")
)
FRONTEND_URL = os.environ.get(
    "FRONTEND_URL", "http://127.0.0.1:5500/frontend/index.html"
)


def configure_app(app):
    app.secret_key = "secret_key_123"
    app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024
    app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = None
    app.config["SESSION_COOKIE_SECURE"] = False

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
