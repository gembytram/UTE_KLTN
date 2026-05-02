import os
import re
import sqlite3
from dotenv import load_dotenv
load_dotenv(override=True)

try:
    import psycopg2  # type: ignore[import-not-found]
    from psycopg2.extras import RealDictCursor  # type: ignore[import-not-found]
except Exception:
    psycopg2 = None
    RealDictCursor = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = "/tmp/db.sqlite" if os.environ.get("VERCEL") == "1" else os.path.join(BASE_DIR, "db.sqlite")
DB_PATH = os.environ.get("DB_PATH", DEFAULT_DB_PATH)
DATABASE_URL = (os.environ.get("DATABASE_URL") or "").strip()
USE_POSTGRES = DATABASE_URL.lower().startswith("postgresql://") or DATABASE_URL.lower().startswith("postgres://")


def _rewrite_insert_or_ignore(sql):
    pattern = re.compile(r"^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+", re.IGNORECASE | re.DOTALL)
    if not pattern.search(sql):
        return sql
    rewritten = pattern.sub("INSERT INTO ", sql, count=1)
    trimmed = rewritten.rstrip()
    has_semicolon = trimmed.endswith(";")
    if has_semicolon:
        trimmed = trimmed[:-1]
    trimmed = f"{trimmed} ON CONFLICT DO NOTHING"
    return f"{trimmed};" if has_semicolon else trimmed


def _rewrite_qmark_placeholders(sql):
    out = []
    in_single = False
    in_double = False
    i = 0
    while i < len(sql):
        ch = sql[i]
        if ch == "'" and not in_double:
            if in_single and i + 1 < len(sql) and sql[i + 1] == "'":
                out.append("''")
                i += 2
                continue
            in_single = not in_single
            out.append(ch)
            i += 1
            continue
        if ch == '"' and not in_single:
            in_double = not in_double
            out.append(ch)
            i += 1
            continue
        if ch == "?" and not in_single and not in_double:
            out.append("%s")
            i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def _rewrite_sql(sql, engine):
    if engine != "postgres":
        return sql
    rewritten = _rewrite_insert_or_ignore(sql)
    rewritten = _rewrite_qmark_placeholders(rewritten)
    return rewritten


def _split_sql_statements(script):
    stmts = []
    buf = []
    in_single = False
    in_double = False
    i = 0
    while i < len(script):
        ch = script[i]
        if ch == "'" and not in_double:
            if in_single and i + 1 < len(script) and script[i + 1] == "'":
                buf.append("''")
                i += 2
                continue
            in_single = not in_single
            buf.append(ch)
            i += 1
            continue
        if ch == '"' and not in_single:
            in_double = not in_double
            buf.append(ch)
            i += 1
            continue
        if ch == ";" and not in_single and not in_double:
            statement = "".join(buf).strip()
            if statement:
                stmts.append(statement)
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    tail = "".join(buf).strip()
    if tail:
        stmts.append(tail)
    return stmts


class CursorCompat:
    def __init__(self, connection, cursor, engine):
        self._connection = connection
        self._cursor = cursor
        self._engine = engine
        self.lastrowid = getattr(cursor, "lastrowid", None)

    def execute(self, query, params=None):
        sql = _rewrite_sql(query, self._engine)
        args = params or ()
        self._cursor.execute(sql, args)
        if self._engine == "postgres":
            self.lastrowid = None
            if sql.lstrip().upper().startswith("INSERT"):
                try:
                    with self._connection._raw.cursor() as c2:
                        c2.execute("SELECT LASTVAL()")
                        self.lastrowid = c2.fetchone()[0]
                except Exception:
                    self.lastrowid = None
        else:
            self.lastrowid = getattr(self._cursor, "lastrowid", None)
        return self

    def executemany(self, query, seq_of_params):
        sql = _rewrite_sql(query, self._engine)
        self._cursor.executemany(sql, seq_of_params)
        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    @property
    def rowcount(self):
        return self._cursor.rowcount


class ConnectionCompat:
    def __init__(self, raw, engine):
        self._raw = raw
        self._engine = engine

    def cursor(self):
        if self._engine == "postgres":
            cur = self._raw.cursor(cursor_factory=RealDictCursor)
        else:
            cur = self._raw.cursor()
        return CursorCompat(self, cur, self._engine)

    def execute(self, query, params=None):
        cur = self.cursor()
        return cur.execute(query, params)

    def executemany(self, query, seq_of_params):
        cur = self.cursor()
        return cur.executemany(query, seq_of_params)

    def executescript(self, script):
        if self._engine == "sqlite":
            self._raw.executescript(script)
            return
        for statement in _split_sql_statements(script):
            self.execute(statement)

    def commit(self):
        self._raw.commit()

    def rollback(self):
        self._raw.rollback()

    def close(self):
        self._raw.close()


def get_db():
    if not USE_POSTGRES:
        raise RuntimeError(
            "Project đã chuyển sang PostgreSQL. Hãy set DATABASE_URL dạng "
            "postgresql://user:password@host:port/database"
        )
    if psycopg2 is None:
        raise RuntimeError("Thiếu package psycopg2. Hãy cài: pip install psycopg2-binary")
    raw = psycopg2.connect(DATABASE_URL)
    return ConnectionCompat(raw, "postgres")


def _table_columns(conn, table):
    if USE_POSTGRES:
        rows = conn.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ?
            """,
            (table,),
        ).fetchall()
        return {row["column_name"] for row in rows}

    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {row[1] for row in rows}


def migrate_db(conn):
    """Thêm cột mới cho DB cũ (SQLite)."""
    cur = conn.cursor()
    ucols = _table_columns(conn, "users")
    if "he_dao_tao" not in ucols:
        cur.execute("ALTER TABLE users ADD COLUMN he_dao_tao TEXT DEFAULT ''")
    if "linh_vuc_phu_trach" not in ucols:
        cur.execute("ALTER TABLE users ADD COLUMN linh_vuc_phu_trach TEXT DEFAULT ''")
    if "gmail" not in ucols:
        cur.execute("ALTER TABLE users ADD COLUMN gmail TEXT DEFAULT ''")
    fcols = _table_columns(conn, "linh_vuc_phu_trach")
    if fcols:
        if "ten" not in fcols:
            cur.execute("ALTER TABLE linh_vuc_phu_trach ADD COLUMN ten TEXT DEFAULT ''")
        if "name" in fcols:
            cur.execute(
                """
                UPDATE linh_vuc_phu_trach
                SET ten = COALESCE(NULLIF(trim(ten), ''), trim(name), '')
                """
            )
        cur.execute("DELETE FROM linh_vuc_phu_trach WHERE COALESCE(trim(ten), '') = ''")
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_linh_vuc_phu_trach_ten
            ON linh_vuc_phu_trach (ten)
            """
        )
    jfcols = _table_columns(conn, "user_linh_vuc_phu_trach")
    if jfcols:
        if "field_id" not in jfcols:
            cur.execute("ALTER TABLE user_linh_vuc_phu_trach ADD COLUMN field_id INTEGER")
        if "linh_vuc_phu_trach_id" in jfcols:
            cur.execute(
                """
                UPDATE user_linh_vuc_phu_trach
                SET field_id = COALESCE(field_id, linh_vuc_phu_trach_id)
                """
            )
        cur.execute(
            """
            DELETE FROM user_linh_vuc_phu_trach
            WHERE user_id IS NULL OR field_id IS NULL
            """
        )
        if USE_POSTGRES:
            cur.execute(
                """
                DELETE FROM user_linh_vuc_phu_trach a
                USING user_linh_vuc_phu_trach b
                WHERE a.ctid < b.ctid
                  AND a.user_id = b.user_id
                  AND a.field_id = b.field_id
                """
            )
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_user_linh_vuc_user_field
            ON user_linh_vuc_phu_trach (user_id, field_id)
            """
        )
    if USE_POSTGRES:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS linh_vuc_phu_trach (
                id SERIAL PRIMARY KEY,
                ten TEXT UNIQUE NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS user_linh_vuc_phu_trach (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                field_id INTEGER NOT NULL REFERENCES linh_vuc_phu_trach(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, field_id)
            )
            """
        )
    else:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS linh_vuc_phu_trach (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ten TEXT UNIQUE NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS user_linh_vuc_phu_trach (
                user_id INTEGER NOT NULL,
                field_id INTEGER NOT NULL,
                PRIMARY KEY (user_id, field_id),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(field_id) REFERENCES linh_vuc_phu_trach(id) ON DELETE CASCADE
            )
            """
        )
    if USE_POSTGRES:
        cur.execute(
            """
            UPDATE users
            SET gmail = lower(trim(ma) || '@hcmute.edu.vn')
            WHERE coalesce(trim(gmail), '') = ''
            """
        )
        cur.execute(
            """
            UPDATE users
            SET linh_vuc = trim(split_part(coalesce(linh_vuc, ''), ',', 1))
            WHERE coalesce(trim(linh_vuc), '') <> ''
            """
        )
    else:
        cur.execute(
            """
            UPDATE users
            SET gmail = lower(trim(ma) || '@hcmute.edu.vn')
            WHERE coalesce(trim(gmail), '') = ''
            """
        )
        cur.execute(
            """
            UPDATE users
            SET linh_vuc = trim(
                CASE
                    WHEN instr(coalesce(linh_vuc, ''), ',') > 0
                        THEN substr(linh_vuc, 1, instr(linh_vuc, ',') - 1)
                    ELSE coalesce(linh_vuc, '')
                END
            )
            WHERE coalesce(trim(linh_vuc), '') <> ''
            """
        )
    dcols = _table_columns(conn, "dot")
    if "he_dao_tao" not in dcols:
        cur.execute("ALTER TABLE dot ADD COLUMN he_dao_tao TEXT DEFAULT ''")
    if "nganh" not in dcols:
        cur.execute("ALTER TABLE dot ADD COLUMN nganh TEXT DEFAULT ''")
    gcols = _table_columns(conn, "gv_slot")
    if "he_dao_tao" not in gcols:
        cur.execute("ALTER TABLE gv_slot ADD COLUMN he_dao_tao TEXT DEFAULT 'DaiTra'")
    ccols = _table_columns(conn, "cham_diem")
    if "criteria_json" not in ccols:
        cur.execute("ALTER TABLE cham_diem ADD COLUMN criteria_json TEXT DEFAULT ''")
    dkcols = _table_columns(conn, "dang_ky")
    if "gv_pb_id" not in dkcols:
        cur.execute("ALTER TABLE dang_ky ADD COLUMN gv_pb_id INTEGER")
    if "chu_tich_id" not in dkcols:
        cur.execute("ALTER TABLE dang_ky ADD COLUMN chu_tich_id INTEGER")
    if "thu_ky_id" not in dkcols:
        cur.execute("ALTER TABLE dang_ky ADD COLUMN thu_ky_id INTEGER")
    if "uy_vien_ids" not in dkcols:
        cur.execute("ALTER TABLE dang_ky ADD COLUMN uy_vien_ids TEXT DEFAULT '[]'")
    if "hoi_dong_id" not in dkcols:
        cur.execute("ALTER TABLE dang_ky ADD COLUMN hoi_dong_id INTEGER")
    cur.execute(
        "UPDATE users SET mat_khau = '123456' WHERE mat_khau = '12345678910'"
    )
    conn.commit()


def init_db():
    conn = get_db()
    if USE_POSTGRES:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                ma TEXT UNIQUE NOT NULL,
                gmail TEXT DEFAULT '',
                ho_ten TEXT NOT NULL,
                mat_khau TEXT NOT NULL,
                role TEXT NOT NULL,
                linh_vuc TEXT,
                linh_vuc_phu_trach TEXT DEFAULT '',
                he_dao_tao TEXT DEFAULT ''
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS dot (
                id SERIAL PRIMARY KEY,
                ten_dot TEXT NOT NULL,
                loai TEXT NOT NULL,
                han_dang_ky TEXT,
                han_nop TEXT,
                trang_thai TEXT DEFAULT 'mo',
                he_dao_tao TEXT DEFAULT '',
                nganh TEXT DEFAULT ''
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS gv_slot (
                id SERIAL PRIMARY KEY,
                gv_id INTEGER REFERENCES users(id),
                dot_id INTEGER REFERENCES dot(id),
                quota INTEGER DEFAULT 5,
                slot_con_lai INTEGER DEFAULT 5,
                duyet_tbm INTEGER DEFAULT 0,
                he_dao_tao TEXT DEFAULT 'DaiTra'
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS hoi_dong (
                id SERIAL PRIMARY KEY,
                ten TEXT NOT NULL,
                nguoi_tao_id INTEGER NOT NULL REFERENCES users(id),
                chu_tich_id INTEGER REFERENCES users(id),
                thu_ky_id INTEGER REFERENCES users(id),
                gv_pb_id INTEGER REFERENCES users(id),
                thoi_gian TIMESTAMP,
                phong TEXT,
                tv_ids TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS dang_ky (
                id SERIAL PRIMARY KEY,
                sv_id INTEGER REFERENCES users(id),
                gv_id INTEGER REFERENCES users(id),
                dot_id INTEGER REFERENCES dot(id),
                loai TEXT NOT NULL,
                ten_de_tai TEXT,
                linh_vuc TEXT,
                trang_thai TEXT DEFAULT 'cho_duyet',
                gv_pb_id INTEGER REFERENCES users(id),
                hoi_dong_id INTEGER REFERENCES hoi_dong(id),
                chu_tich_id INTEGER REFERENCES users(id),
                thu_ky_id INTEGER REFERENCES users(id),
                uy_vien_ids TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS nop_bai (
                id SERIAL PRIMARY KEY,
                dang_ky_id INTEGER REFERENCES dang_ky(id),
                loai_file TEXT,
                file_path TEXT,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS cham_diem (
                id SERIAL PRIMARY KEY,
                dang_ky_id INTEGER REFERENCES dang_ky(id),
                gv_id INTEGER REFERENCES users(id),
                vai_tro TEXT,
                diem REAL,
                nhan_xet TEXT,
                cau_hoi TEXT,
                criteria_json TEXT DEFAULT ''
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS thong_bao (
                id SERIAL PRIMARY KEY,
                nguoi_nhan_id INTEGER NOT NULL REFERENCES users(id),
                nguoi_gui_id INTEGER REFERENCES users(id),
                dang_ky_id INTEGER REFERENCES dang_ky(id),
                loai TEXT,
                noi_dung TEXT,
                da_doc INTEGER DEFAULT 0,
                tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS linh_vuc_phu_trach (
                id SERIAL PRIMARY KEY,
                ten TEXT UNIQUE NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_linh_vuc_phu_trach (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                field_id INTEGER NOT NULL REFERENCES linh_vuc_phu_trach(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, field_id)
            )
            """
        )
    else:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ma TEXT UNIQUE NOT NULL,        -- MSSV hoặc MAGV
                gmail TEXT DEFAULT '',          -- email lấy từ Google Sheet
                ho_ten TEXT NOT NULL,
                mat_khau TEXT NOT NULL,
                role TEXT NOT NULL,             -- SV / GV / TBM
                linh_vuc TEXT,                  -- major / chuyên môn (chuỗi phân tách bởi dấu phẩy)
                linh_vuc_phu_trach TEXT DEFAULT '', -- lĩnh vực phụ trách chính (mỗi người 1 lĩnh vực)
                he_dao_tao TEXT DEFAULT ''      -- DaiTra / CLC (SV & có thể dùng cho GV)
            );

            CREATE TABLE IF NOT EXISTS dot (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ten_dot TEXT NOT NULL,
                loai TEXT NOT NULL,             -- BCTT / KLTN
                han_dang_ky TEXT,
                han_nop TEXT,
                trang_thai TEXT DEFAULT 'mo',    -- mo / dong
                he_dao_tao TEXT DEFAULT '',     -- để trống nếu đợt chung (không tách Đại trà/CLC)
                nganh TEXT DEFAULT ''           -- QLCN, TMĐT, ... (khớp linh_vuc SV)
            );

            CREATE TABLE IF NOT EXISTS gv_slot (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gv_id INTEGER,
                dot_id INTEGER,
                quota INTEGER DEFAULT 5,
                slot_con_lai INTEGER DEFAULT 5,
                duyet_tbm INTEGER DEFAULT 0,    -- 0/1
                he_dao_tao TEXT DEFAULT 'DaiTra', -- DaiTra / CLC — pool slot theo hệ SV
                FOREIGN KEY(gv_id) REFERENCES users(id),
                FOREIGN KEY(dot_id) REFERENCES dot(id)
            );

            CREATE TABLE IF NOT EXISTS dang_ky (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sv_id INTEGER,
                gv_id INTEGER,
                dot_id INTEGER,
                loai TEXT NOT NULL,             -- BCTT / KLTN
                ten_de_tai TEXT,
                linh_vuc TEXT,
                trang_thai TEXT DEFAULT 'cho_duyet',  -- cho_duyet/dong_y/tu_choi/pass/fail
                gv_pb_id INTEGER,               -- GV phản biện (assigned by TBM)
                hoi_dong_id INTEGER,            -- ID của hội đồng từ bảng hoi_dong
                chu_tich_id INTEGER,            -- Chủ tịch hội đồng (assigned by TBM)
                thu_ky_id INTEGER,              -- Thư ký hội đồng (assigned by TBM)
                uy_vien_ids TEXT,               -- JSON array of uy vien IDs (assigned by TBM)
                FOREIGN KEY(sv_id) REFERENCES users(id),
                FOREIGN KEY(gv_id) REFERENCES users(id),
                FOREIGN KEY(gv_pb_id) REFERENCES users(id),
                FOREIGN KEY(hoi_dong_id) REFERENCES hoi_dong(id),
                FOREIGN KEY(chu_tich_id) REFERENCES users(id),
                FOREIGN KEY(thu_ky_id) REFERENCES users(id),
                FOREIGN KEY(dot_id) REFERENCES dot(id)
            );

            CREATE TABLE IF NOT EXISTS nop_bai (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dang_ky_id INTEGER,
                loai_file TEXT,   -- bai_lam/phieu_xn/turnitin/bai_chinh_sua/bien_ban_giai_trinh
                file_path TEXT,
                uploaded_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY(dang_ky_id) REFERENCES dang_ky(id)
            );

            CREATE TABLE IF NOT EXISTS cham_diem (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dang_ky_id INTEGER,
                gv_id INTEGER,
                vai_tro TEXT,     -- HD / PB / CT / TV
                diem REAL,
                nhan_xet TEXT,
                cau_hoi TEXT,
                criteria_json TEXT DEFAULT '',
                FOREIGN KEY(dang_ky_id) REFERENCES dang_ky(id),
                FOREIGN KEY(gv_id) REFERENCES users(id)
            );
                             
            CREATE TABLE IF NOT EXISTS thong_bao (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nguoi_nhan_id INTEGER NOT NULL,
                nguoi_gui_id INTEGER,
                dang_ky_id INTEGER,
                loai TEXT,          -- 'tu_choi_gvhd' / 'tu_choi_cthd'
                noi_dung TEXT,      -- lý do từ chối GV ghi
                da_doc INTEGER DEFAULT 0,
                tao_luc TEXT DEFAULT (datetime('now')),
                FOREIGN KEY(nguoi_nhan_id) REFERENCES users(id),
                FOREIGN KEY(nguoi_gui_id) REFERENCES users(id),
                FOREIGN KEY(dang_ky_id) REFERENCES dang_ky(id)
            );

            CREATE TABLE IF NOT EXISTS linh_vuc_phu_trach (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ten TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_linh_vuc_phu_trach (
                user_id INTEGER NOT NULL,
                field_id INTEGER NOT NULL,
                PRIMARY KEY (user_id, field_id),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(field_id) REFERENCES linh_vuc_phu_trach(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS hoi_dong (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ten TEXT NOT NULL,
                nguoi_tao_id INTEGER NOT NULL,
                chu_tich_id INTEGER,
                thu_ky_id INTEGER,
                gv_pb_id INTEGER,
                thoi_gian TEXT,
                phong TEXT,
                tv_ids TEXT,  -- JSON array of thanh vien IDs
                FOREIGN KEY(nguoi_tao_id) REFERENCES users(id),
                FOREIGN KEY(chu_tich_id) REFERENCES users(id),
                FOREIGN KEY(thu_ky_id) REFERENCES users(id),
                FOREIGN KEY(gv_pb_id) REFERENCES users(id)
            );
        """)

    migrate_db(conn)
    conn.commit()
    conn.close()
    print("Database initialized on PostgreSQL.")
