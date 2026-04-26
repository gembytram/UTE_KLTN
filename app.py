import os
import socket

from flask import Flask
from flask_cors import CORS

from api.routes import register_routes
from config.settings import configure_app
from database import init_db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
configure_app(app)
CORS(app, supports_credentials=True)

# Khởi tạo database nếu chưa có
# Local: luôn khởi tạo
# Vercel: dùng API endpoint /api/admin/init-db thay vì tự động
try:
    if os.environ.get("VERCEL") != "1":
        init_db()
except Exception as e:
    print(f"⚠️ Database init warning: {e}")

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
    app.run(debug=True, port=port)
