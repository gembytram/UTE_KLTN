import os
import csv
import urllib.request
from database import USE_POSTGRES, get_db, init_db

# 1. Quota GV theo HỆ (Đại trà / CLC): mỗi (GV, đợt) có 2 dòng gv_slot — SV đăng ký BCTT dùng đúng pool theo he_dao_tao.
QUOTA_LEGACY = {
    "hieunk@hcmute.edu.vn": {"DaiTra": 15, "CLC": 270},
    "trangltd@hcmute.edu.vn": {"DaiTra": 20, "CLC": 275},
    "longntc@hcmute.edu.vn": {"DaiTra": 25, "CLC": 280},
    "vangdq@hcmute.edu.vn": {"DaiTra": 30, "CLC": 285},
    "huongltm@hcmute.edu.vn": {"DaiTra": 35, "CLC": 290},
    "yendtk@hcmute.edu.vn": {"DaiTra": 40, "CLC": 295},
    "phuongtta@hcmute.edu.vn": {"DaiTra": 45, "CLC": 300},
    "anhctn@hcmute.edu.vn": {"DaiTra": 50, "CLC": 305},
    "nuongltm@hcmute.edu.vn": {"DaiTra": 55, "CLC": 310},
    "nghianh@hcmute.edu.vn": {"DaiTra": 60, "CLC": 315},
    "anhnth@hcmute.edu.vn": {"DaiTra": 65, "CLC": 320},
    "tramnth@hcmute.edu.vn": {"DaiTra": 70, "CLC": 325},
    "duyvq@hcmute.edu.vn": {"DaiTra": 75, "CLC": 330},
    "hongntt@hcmute.edu.vn": {"DaiTra": 80, "CLC": 335},
    "phamhieu@hcmute.edu.vn": {"DaiTra": 85, "CLC": 340},
    "toaitk@hcmute.edu.vn": {"DaiTra": 90, "CLC": 345},
    "lananhnt@hcmute.edu.vn": {"DaiTra": 95, "CLC": 350},
    "viltt@hcmute.edu.vn": {"DaiTra": 100, "CLC": 355},
    "linhtd@hcmute.edu.vn": {"DaiTra": 105, "CLC": 360},
    "huynpa@hcmute.edu.vn": {"DaiTra": 110, "CLC": 365},
    "ngocnpn@hcmute.edu.vn": {"DaiTra": 115, "CLC": 370},
    "hoatrt@hcmute.edu.vn": {"DaiTra": 120, "CLC": 375},
    "phuongthuynt@hcmute.edu.vn": {"DaiTra": 125, "CLC": 380},
    "quanhnm@hcmute.edu.vn": {"DaiTra": 130, "CLC": 385},
    "nguyenthuyphuong@hcmute.edu.vn": {"DaiTra": 135, "CLC": 390},
    "thanhmv@hcmute.edu.vn": {"DaiTra": 140, "CLC": 395},
    "thanhltt@hcmute.edu.vn": {"DaiTra": 145, "CLC": 400},
    "thaindh@hcmute.edu.vn": {"DaiTra": 150, "CLC": 405},
    "thiennd@hcmute.edu.vn": {"DaiTra": 155, "CLC": 410},
    "lamgiangkkt@hcmute.edu.vn": {"DaiTra": 160, "CLC": 415},
    "vanngta@hcmute.edu.vn": {"DaiTra": 165, "CLC": 420},
    "tramntm@hcmute.edu.vn": {"DaiTra": 170, "CLC": 425},
    "btanh@hcmute.edu.vn": {"DaiTra": 175, "CLC": 430},
    "vanntt@hcmute.edu.vn": {"DaiTra": 180, "CLC": 435},
    "thupx@hcmute.edu.vn": {"DaiTra": 185, "CLC": 440},
    "tuhtc@hcmute.edu.vn": {"DaiTra": 190, "CLC": 445},
    "thangpvh@hcmute.edu.vn": {"DaiTra": 195, "CLC": 450},
    "xuyenhth@hcmute.edu.vn": {"DaiTra": 200, "CLC": 455},
    "huect@hcmute.edu.vn": {"DaiTra": 205, "CLC": 460},
    "thinhbt@hcmute.edu.vn": {"DaiTra": 210, "CLC": 465},
    "nguyenpk@hcmute.edu.vn": {"DaiTra": 215, "CLC": 470},
    "tothihang@hcmute.edu.vn": {"DaiTra": 220, "CLC": 475},
    "hanhvtx@hcmute.edu.vn": {"DaiTra": 225, "CLC": 480},
    "trucldt@hcmute.edu.vn": {"DaiTra": 230, "CLC": 485},
    "minhta@hcmute.edu.vn": {"DaiTra": 235, "CLC": 490},
    "namvt@hcmute.edu.vn": {"DaiTra": 240, "CLC": 495},
    "thuynguyen@hcmute.edu.vn": {"DaiTra": 245, "CLC": 500},
    "hienptt@hcmute.edu.vn": {"DaiTra": 250, "CLC": 505},
    "hongnt@hcmute.edu.vn": {"DaiTra": 255, "CLC": 510},
    "ise.thien@gmail.com": {"DaiTra": 265, "CLC": 520},
}

# 2. Mapping Chuyên môn / Lĩnh vực chi tiết mới thêm
GV_LINH_VUC = {
    "trangltd@hcmute.edu.vn": ["KDQT"],
    "hoatrt@hcmute.edu.vn": ["KDQT"],
    "phuongthuynt@hcmute.edu.vn": ["KDQT"],
    "quanhnm@hcmute.edu.vn": ["KDQT"],
    "nguyenthuyphuong@hcmute.edu.vn": ["KDQT"],
    "thanhmv@hcmute.edu.vn": ["KDQT"],
    "trucldt@hcmute.edu.vn": ["KDQT"],
    "minhta@hcmute.edu.vn": ["KDQT"],
    "longntc@hcmute.edu.vn": ["Ktoan", "Mô phỏng"],
    "vangdq@hcmute.edu.vn": ["Ktoan"],
    "huongltm@hcmute.edu.vn": ["Ktoan"],
    "yendtk@hcmute.edu.vn": ["Ktoan"],
    "phuongtta@hcmute.edu.vn": ["Ktoan"],
    "anhctn@hcmute.edu.vn": ["Ktoan"],
    "nuongltm@hcmute.edu.vn": ["Ktoan"],
    "nghianh@hcmute.edu.vn": ["Ktoan"],
    "anhnth@hcmute.edu.vn": ["Ktoan"],
    "tramnth@hcmute.edu.vn": ["Ktoan"],
    "duyvq@hcmute.edu.vn": ["Ktoan"],
    "hongntt@hcmute.edu.vn": ["Ktoan"],
    "phamhieu@hcmute.edu.vn": ["Ktoan"],
    "xuyenhth@hcmute.edu.vn": ["Log"],
    "huect@hcmute.edu.vn": ["Log"],
    "thinhbt@hcmute.edu.vn": ["Log"],
    "nguyenpk@hcmute.edu.vn": ["Log"],
    "tothihang@hcmute.edu.vn": ["Log"],
    "hanhvtx@hcmute.edu.vn": ["Log"],
    "namvt@hcmute.edu.vn": ["Log"],
    "hieunk@hcmute.edu.vn": ["QLCN", "Chất lượng"],
    "thanhltt@hcmute.edu.vn": ["QLCN", "Marketing"],
    "thaindh@hcmute.edu.vn": ["QLCN", "Mô phỏng", "Sản xuất"],
    "thiennd@hcmute.edu.vn": ["QLCN", "Chất lượng", "Sản xuất", "AI", "Mô phỏng"],
    "lamgiangkkt@hcmute.edu.vn": ["QLCN", "Chất lượng"],
    "vanngta@hcmute.edu.vn": ["QLCN", "Chất lượng"],
    "tramntm@hcmute.edu.vn": ["QLCN", "Sản xuất"],
    "btanh@hcmute.edu.vn": ["QLCN"],
    "vanntt@hcmute.edu.vn": ["QLCN"],
    "thupx@hcmute.edu.vn": ["QLCN"],
    "tuhtc@hcmute.edu.vn": ["QLCN"],
    "thangpvh@hcmute.edu.vn": ["QLCN", "Sản xuất"],
    "thuynguyen@hcmute.edu.vn": ["QLCN", "HR"],
    "hienptt@hcmute.edu.vn": ["QLCN", "HR"],
    "ise.thien@gmail.com": ["QLCN", "Mô phỏng"],
    "toaitk@hcmute.edu.vn": ["TMĐT"],
    "lananhnt@hcmute.edu.vn": ["TMĐT"],
    "viltt@hcmute.edu.vn": ["TMĐT"],
    "linhtd@hcmute.edu.vn": ["TMĐT"],
    "huynpa@hcmute.edu.vn": ["TMĐT"],
    "ngocnpn@hcmute.edu.vn": ["TMĐT"]
}

GV_LINH_VUC_PHU_TRACH = {
    "trangltd@hcmute.edu.vn": ["Kinh doanh"],
    "hoatrt@hcmute.edu.vn": ["Chất lượng"],
    "phuongthuynt@hcmute.edu.vn": ["Marketing"],
    "quanhnm@hcmute.edu.vn": ["Mô phỏng"],
    "nguyenthuyphuong@hcmute.edu.vn": ["Sản xuất"],
    "thanhmv@hcmute.edu.vn": ["Chất lượng"],
    "trucldt@hcmute.edu.vn": ["Sản xuất"],
    "minhta@hcmute.edu.vn": ["AI"],
    "longntc@hcmute.edu.vn": ["Mô phỏng"],
    "vangdq@hcmute.edu.vn": ["Kinh doanh"],
    "huongltm@hcmute.edu.vn": ["Khởi nghiệp"],
    "yendtk@hcmute.edu.vn": ["HR"],
    "phuongtta@hcmute.edu.vn": ["AI"],
    "anhctn@hcmute.edu.vn": ["Kinh doanh"],
    "nuongltm@hcmute.edu.vn": ["Chất lượng"],
    "nghianh@hcmute.edu.vn": ["Marketing"],
    "anhnth@hcmute.edu.vn": ["Mô phỏng"],
    "tramnth@hcmute.edu.vn": ["Sản xuất"],
    "duyvq@hcmute.edu.vn": ["Chất lượng"],
    "hongntt@hcmute.edu.vn": ["Sản xuất"],
    "phamhieu@hcmute.edu.vn": ["AI"],
    "xuyenhth@hcmute.edu.vn": ["Mô phỏng"],
    "huect@hcmute.edu.vn": ["Kinh doanh"],
    "thinhbt@hcmute.edu.vn": ["Khởi nghiệp"],
    "nguyenpk@hcmute.edu.vn": ["HR"],
    "tothihang@hcmute.edu.vn": ["AI"],
    "hanhvtx@hcmute.edu.vn": ["Khởi nghiệp"],
    "hieunk@hcmute.edu.vn": ["Chất lượng"],
    "thanhltt@hcmute.edu.vn": ["Marketing"],
    "thaindh@hcmute.edu.vn": ["Mô phỏng", "Sản xuất"],
    "thiennd@hcmute.edu.vn": ["Chất lượng", "Sản xuất", "AI", "Mô phỏng"],
    "lamgiangkkt@hcmute.edu.vn": ["Chất lượng"],
    "vanngta@hcmute.edu.vn": ["Chất lượng"],
    "tramntm@hcmute.edu.vn": ["Sản xuất"],
    "btanh@hcmute.edu.vn": ["Khởi nghiệp"],
    "vanntt@hcmute.edu.vn": ["AI"],
    "thupx@hcmute.edu.vn": ["Kinh doanh"],
    "tuhtc@hcmute.edu.vn": ["Kinh doanh"],
    "thangpvh@hcmute.edu.vn": ["Sản xuất"],
    "thuynguyen@hcmute.edu.vn": ["HR"],
    "hienptt@hcmute.edu.vn": ["HR"],
    "ise.thien@gmail.com": ["Mô phỏng"],
    "toaitk@hcmute.edu.vn": ["Chất lượng"],
    "lananhnt@hcmute.edu.vn": ["Marketing"],
    "viltt@hcmute.edu.vn": ["Mô phỏng"],
    "linhtd@hcmute.edu.vn": ["Sản xuất"],
    "huynpa@hcmute.edu.vn": ["Chất lượng"],
    "ngocnpn@hcmute.edu.vn": ["Sản xuất"],
    "hongnt@hcmute.edu.vn": ["AI"]
}

# 3. Danh sách Đợt đăng ký (chung, không tách Đại trà / CLC — chỉ phân theo ngành)
# Tuple: (Tên Đợt, Loại, Ngày BĐ, Ngày KT, Trạng Thái, he_dao_tao, nganh) — he_dao_tao luôn rỗng
NEW_DOTS = [
    ("Đợt 1 HK1 26-27 - QLCN", "KLTN", "2026-03-29", "2026-04-07", "mo", "", "QLCN"),
    ("Đợt 2 HK1 26-27 - QLCN", "BCTT", "2026-03-29", "2026-04-07", "mo", "", "QLCN"),
    ("Đợt 1 HK1 26-27 - TMĐT", "KLTN", "2026-03-29", "2026-04-07", "mo", "", "TMĐT"),
    ("Đợt 2 HK1 26-27 - TMĐT", "BCTT", "2026-03-29", "2026-04-07", "mo", "", "TMĐT"),
    ("Đợt 1 HK1 26-27 - KDQT", "KLTN", "2026-03-29", "2026-04-07", "mo", "", "KDQT"),
    ("Đợt 2 HK1 26-27 - KDQT", "BCTT", "2026-03-29", "2026-04-07", "mo", "", "KDQT"),
    ("Đợt 1 HK1 26-27 - Log", "KLTN", "2026-03-29", "2026-04-07", "mo", "", "Logistic"),
    ("Đợt 2 HK1 26-27 - Log", "BCTT", "2026-03-29", "2026-04-07", "mo", "", "Logistic"),
]


def normalize_he(raw):
    """Chuẩn hóa hệ từ Google Sheet → DaiTra | CLC | ''."""
    s = (raw or "").strip().upper().replace(" ", "").replace("Ạ", "A")
    if not s:
        return ""
    if "CLC" in s:
        return "CLC"
    if "DAITRA" in s or "ĐẠITRÀ" in (raw or "").upper() or "ĐẠI" in (raw or "").upper():
        return "DaiTra"
    if "TRÀ" in (raw or "").upper() or "TRA" in s:
        return "DaiTra"
    return ""


def pick_primary_field(value):
    """Mỗi user có một lĩnh vực phụ trách chính."""
    text = (value or "").strip()
    if not text:
        return ""
    return text.split(",")[0].strip()


def seed_default_data():
    """Tạo tài khoản test mặc định nếu Google Sheet không khả dụng."""
    conn = get_db()
    c = conn.cursor()
    
    # Seed tài khoản test
    test_users = [
        ("ADMIN001", "admin001@hcmute.edu.vn", "Admin Test", "123456", "TBM", "", "", ""),
        ("GV001", "gv001@hcmute.edu.vn", "Giảng Viên Test", "123456", "GV", "QLCN", "", ""),
        ("SV001", "sv001@hcmute.edu.vn", "Sinh Viên Test", "123456", "SV", "QLCN", "", "DaiTra"),
        ("SV002", "sv002@hcmute.edu.vn", "Sinh Viên CLC", "123456", "SV", "QLCN", "", "CLC"),
    ]
    
    c.executemany("""
        INSERT OR IGNORE INTO users (ma, gmail, ho_ten, mat_khau, role, linh_vuc, linh_vuc_phu_trach, he_dao_tao)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, test_users)
    
    # Seed đợt
    c.executemany("""
        INSERT INTO dot (ten_dot, loai, han_dang_ky, han_nop, trang_thai, he_dao_tao, nganh)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, [(d[0], d[1], d[2], d[3], d[4], d[5], d[6]) for d in NEW_DOTS])
    
    conn.commit()
    conn.close()
    print("✅ Đã seed dữ liệu test mặc định (tài khoản: ADMIN001/GV001/SV001, mật khẩu: 123456)")


def import_from_sheets(delete_old_db=True):
    """Import dữ liệu từ Google Sheet."""
    if not USE_POSTGRES:
        raise RuntimeError("Project đã chuyển PostgreSQL-only. Hãy set DATABASE_URL trước khi import.")

    # Khởi tạo lại cấu trúc database
    init_db()
    print("✨ Đã tạo mới các bảng trong database.")

    sheet_id = "1ON6evA-pkI9201eQ1R5o6bvMmZrO-7VQvwmr1HaSDPs"
    csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid=0"

    print("⏳ Đang tải dữ liệu từ Google Sheets...")
    try:
        req = urllib.request.Request(csv_url)
        with urllib.request.urlopen(req, timeout=10) as response:
            lines = [line.decode('utf-8-sig') for line in response.readlines()]
    except Exception as e:
        print(f"❌ Lỗi khi tải Google Sheets: {e}")
        print("📌 Sử dụng seed data mặc định thay vào...")
        seed_default_data()
        return

    reader = csv.DictReader(lines)
    users = []
    gv_email_mapping = {}
    gv_fields_by_email = {}

    def add_unique_field(email_key, field_value):
        field_value = (field_value or "").strip()
        if not email_key or not field_value:
            return
        bucket = gv_fields_by_email.setdefault(email_key, [])
        if field_value not in bucket:
            bucket.append(field_value)

    for row in reader:
        email = row.get("Email", "").strip().lower()
        ma = row.get("MS", "").strip()
        ho_ten = row.get("Ten", "").strip()
        role_raw = row.get("Role", "").strip()
        linh_vuc = row.get("Major", "").strip()  # Default lấy từ Google Sheet
        field_raw = row.get("Field", "").strip()
        he_raw = (
            row.get("He", "").strip()
            or row.get("Hệ", "").strip()
            or row.get("HeDaoTao", "").strip()
            or row.get("System", "").strip()
        )
        he_dao_tao = normalize_he(he_raw)

        if not ma or not ho_ten:
            continue

        role = "SV"
        if role_raw.upper() == "LECTURER":
            role = "GV"
            gv_email_mapping[ma.upper()] = email
        elif role_raw.upper() == "TBM":
            role = "TBM"
            gv_email_mapping[ma.upper()] = email

        # NẾU CÓ TRONG FILE MAPPING MỚI -> Thay thế chuyên môn chi tiết (VD: QLCN, Chất lượng, AI)
        if email in GV_LINH_VUC:
            linh_vuc = ", ".join(GV_LINH_VUC[email])

        if role in ("GV", "TBM"):
            add_unique_field(email, field_raw)

        # Nếu có mapping email -> linh_vuc_phu_trach do bạn cung cấp, ưu tiên dùng mapping này.
        if email in GV_LINH_VUC_PHU_TRACH:
            for value in GV_LINH_VUC_PHU_TRACH[email]:
                add_unique_field(email, value)

        linh_vuc = pick_primary_field(linh_vuc)
        linh_vuc_phu_trach = ", ".join(gv_fields_by_email.get(email, []))

        mat_khau = "123456"
        users.append((ma.upper(), email, ho_ten, mat_khau, role, linh_vuc, linh_vuc_phu_trach, he_dao_tao))

    conn = get_db()
    c = conn.cursor()

    # Insert Users
    c.executemany("""
        INSERT INTO users (ma, gmail, ho_ten, mat_khau, role, linh_vuc, linh_vuc_phu_trach, he_dao_tao)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (ma) DO UPDATE SET
            gmail = EXCLUDED.gmail,
            ho_ten = EXCLUDED.ho_ten,
            role = EXCLUDED.role,
            linh_vuc = EXCLUDED.linh_vuc,
            linh_vuc_phu_trach = EXCLUDED.linh_vuc_phu_trach,
            he_dao_tao = EXCLUDED.he_dao_tao
    """, users)

    # Insert Đợt đăng ký (kèm hệ + ngành trong DB)
    c.executemany("""
        INSERT INTO dot (ten_dot, loai, han_dang_ky, han_nop, trang_thai, he_dao_tao, nganh)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, [(d[0], d[1], d[2], d[3], d[4], d[5], d[6]) for d in NEW_DOTS])

    # Lấy đợt từ DB (đã có he_dao_tao, nganh)
    dot_records = c.execute("SELECT id, ten_dot, he_dao_tao, nganh FROM dot").fetchall()

    # Cấp slot: mỗi (GV, đợt, hệ) — quota Đại trà / CLC lấy từ QUOTA_LEGACY; SV đăng ký BCTT dùng đúng pool theo he_dao_tao
    gvs = c.execute("SELECT id, ma, linh_vuc FROM users WHERE role IN ('GV', 'TBM')").fetchall()
    slots = []

    for gv in gvs:
        gv_id = gv['id']
        gv_ma = gv['ma']
        gv_primary = (gv['linh_vuc'] or "").strip()
        gv_email = gv_email_mapping.get(gv_ma, "")
        leg = QUOTA_LEGACY.get(gv_email, {})
        q_dt = int(leg.get("DaiTra", 5))
        q_clc = int(leg.get("CLC", 5))

        for db_dot in dot_records:
            dot_major = (db_dot["nganh"] or "").strip()

            if dot_major == gv_primary:
                slots.append((gv_id, db_dot["id"], q_dt, q_dt, 1, "DaiTra"))
                slots.append((gv_id, db_dot["id"], q_clc, q_clc, 1, "CLC"))

    c.executemany("""
        INSERT INTO gv_slot (gv_id, dot_id, quota, slot_con_lai, duyet_tbm, he_dao_tao)
        VALUES (?, ?, ?, ?, ?, ?)
    """, slots)

    conn.commit()
    conn.close()

    print(f"✅ Đã import thành công {len(users)} tài khoản.")
    print("✅ Đã cập nhật chi tiết chuyên ngành (Ví dụ: QLCN, Mô phỏng, Sản xuất...)")
    print(f"✅ Đã tạo {len(NEW_DOTS)} đợt đăng ký (chung Đại trà & CLC, theo ngành).")
    print("✅ Đã cấp slot: mỗi (GV, đợt) có 2 pool — Đại trà (QUOTA_LEGACY.DaiTra) & CLC (QUOTA_LEGACY.CLC).")


def run_import(delete_old_db=True):
    """Chạy import dữ liệu (local: xóa DB cũ, Vercel: không xóa)."""
    import_from_sheets(delete_old_db=delete_old_db)
    print("🚀 Hãy chạy lệnh 'python app.py' để thưởng thức hệ thống mới!")


if __name__ == "__main__":
    run_import()
