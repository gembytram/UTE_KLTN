from functools import wraps

from flask import request, session

from utils.response import fail


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user_id = session.get("user_id") or request.headers.get("X-User-Id")
        if not user_id:
            return fail("Chưa đăng nhập", 401)
        return fn(*args, **kwargs)

    return wrapper


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            role = session.get("role") or request.headers.get("X-User-Role")
            if not role:
                return fail("Chưa đăng nhập", 401)
            role_upper = str(role).upper()
            if role_upper not in roles:
                return fail("Không có quyền truy cập", 403)
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def get_current_user(conn):
    uid = session.get("user_id") or request.headers.get("X-User-Id")
    return conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
