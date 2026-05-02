import os
import socket

from authlib.integrations.flask_client import OAuth
from flask import Flask, redirect, session
from flask_cors import CORS

from api.routes import register_routes
from config.settings import (
    FRONTEND_URL,
    GOOGLE_REDIRECT_URI,
    configure_app,
)
from database import get_db, init_db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
configure_app(app)
CORS(app, supports_credentials=True)

oauth = OAuth(app)
oauth.register(
    name="google",
    client_id=os.environ.get("GOOGLE_CLIENT_ID"),
    client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


def _frontend_redirect_by_role(role, error=None):
    page_map = {
        "SV": "dashboard",
        "GV": "huongdan",
        "TBM": "duyetde",
    }
    page = page_map.get((role or "").upper(), "dashboard")
    if error:
        return redirect(f"{FRONTEND_URL}?error={error}")
    return redirect(f"{FRONTEND_URL}?oauth=success&page={page}")


@app.route("/api/auth/google/login", methods=["GET"])
def google_login():
    if not os.environ.get("GOOGLE_CLIENT_ID") or not os.environ.get("GOOGLE_CLIENT_SECRET"):
        return _frontend_redirect_by_role(None, "google_oauth_not_configured")
    return oauth.google.authorize_redirect(GOOGLE_REDIRECT_URI)


@app.route("/api/auth/google/callback", methods=["GET"])
def google_callback():
    try:
        token = oauth.google.authorize_access_token()
    except Exception:
        return _frontend_redirect_by_role(None, "google_auth_failed")

    userinfo = token.get("userinfo")
    if not userinfo:
        try:
            userinfo = oauth.google.userinfo(token=token)
        except Exception:
            userinfo = None

    if not userinfo:
        return _frontend_redirect_by_role(None, "google_userinfo_failed")

    email = (userinfo.get("email") or "").strip().lower()
    email_verified = bool(userinfo.get("email_verified"))
    if not email or not email_verified:
        return ("Google account email chưa được xác thực", 403)

    # Cho phép đăng nhập bằng email trường hoặc local-part trùng với mã người dùng.
    email_local = email.split("@", 1)[0].split("+", 1)[0].strip().lower()

    conn = get_db()
    users = conn.execute(
        """
        SELECT *
        FROM users
          WHERE lower(trim(gmail)) = ?
              OR lower(trim(ma)) = ?
           OR lower(trim(ma) || '@hcmute.edu.vn') = ?
           OR lower(trim(ma) || '@student.hcmute.edu.vn') = ?
        """,
          (email, email_local, email, email),
    ).fetchall()
    conn.close()

    if len(users) == 0:
        print(
            f"[OAuth] No matched user for google_email='{email}', local_part='{email_local}'"
        )
        return _frontend_redirect_by_role(None, "google_access_denied")
    if len(users) > 1:
        return ("Dữ liệu người dùng bị trùng email", 500)

    user = users[0]
    session["user_id"] = user["id"]
    session["role"] = user["role"]
    return _frontend_redirect_by_role(user["role"])


# Khởi tạo database nếu chưa có
# Local: luôn khởi tạo
# Vercel: dùng API endpoint /api/admin/init-db thay vì tự động
try:
    if os.environ.get("VERCEL") != "1":
        init_db()
except Exception as e:
    print(f"Database init warning: {e}")

register_routes(app)


def pick_port():
    for port in (5000, 5001):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return 5001


if __name__ == "__main__":
    port = pick_port()
    print(f"Frontend + API đang chạy tại http://127.0.0.1:{port}")
    print(f"Google redirect URI đang dùng: {GOOGLE_REDIRECT_URI}")
    app.run(debug=True, port=port)
