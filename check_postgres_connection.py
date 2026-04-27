import os
import sys

from database import get_db


def main():
    db_url = (os.environ.get("DATABASE_URL") or "").strip()
    if not db_url:
        print("❌ Chưa có DATABASE_URL.")
        print("Ví dụ: setx DATABASE_URL \"postgresql://postgres:123456@localhost:5432/ute_kltn\"")
        sys.exit(1)

    try:
        conn = get_db()
        row = conn.execute("SELECT version() AS version, current_database() AS db, current_user AS db_user").fetchone()
        conn.close()
        print("✅ Kết nối PostgreSQL thành công")
        print(f"- Database: {row['db']}")
        print(f"- User: {row['db_user']}")
        print(f"- Version: {row['version']}")
    except Exception as exc:
        print("❌ Kết nối PostgreSQL thất bại")
        print(f"Chi tiết: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
