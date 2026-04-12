from datetime import datetime


def map_role(role):
    if role == "SV":
        return "sv"
    if role == "GV":
        return "gv"
    if role == "TBM":
        return "bm"
    return role.lower()


def build_email(ma):
    if not ma:
        return None
    return f"{ma.lower()}@hcmute.edu.vn"


def parse_linh_vuc(value):
    if not value:
        return {"mangDeTai": "", "tenCongTy": ""}
    if "||" not in value:
        return {"mangDeTai": value, "tenCongTy": ""}
    parts = value.split("||", 1)
    return {"mangDeTai": parts[0], "tenCongTy": parts[1]}


def _sv_majors_from_row(sv_row):
    lv = sv_row["linh_vuc"] or ""
    return [x.strip() for x in lv.split(",") if x.strip()]


def _user_majors(user_row):
    lv = user_row["linh_vuc"] or ""
    return [x.strip() for x in lv.split(",") if x.strip()]


def user_has_common_major(user_a, user_b):
    majors_a = _user_majors(user_a)
    majors_b = _user_majors(user_b)
    if not majors_a or not majors_b:
        return False
    return any(m in majors_b for m in majors_a)


def kltn_major_from_dang_ky(linh_vuc_raw):
    meta = parse_linh_vuc(linh_vuc_raw or "")
    return (meta.get("mangDeTai") or "").strip()


def user_covers_kltn_major(user_row, major):
    if not major:
        return True
    parts = [x.strip() for x in (user_row["linh_vuc"] or "").split(",") if x.strip()]
    return major in parts


def assert_kltn_assignees_match_major(conn, major, user_ids):
    if not major:
        return True, None
    seen = set()
    for mid in user_ids:
        if mid is None:
            continue
        try:
            uid = int(mid)
        except (TypeError, ValueError):
            return False, "ID thành viên không hợp lệ"
        if uid in seen:
            continue
        seen.add(uid)
        row = conn.execute(
            "SELECT id, ho_ten, linh_vuc FROM users WHERE id = ?",
            (uid,),
        ).fetchone()
        if not row:
            return False, "Không tìm thấy người dùng id=%s" % uid
        if not user_covers_kltn_major(row, major):
            return False, (
                "GV %s không cùng lĩnh vực với đề tài (%s). "
                "Chỉ được phân công giảng viên có chuyên môn trùng mảng đăng ký."
                % (row["ho_ten"], major)
            )
    return True, None


def normalize_sv_slot_he(sv_row):
    if not sv_row:
        return "DaiTra"
    h = (sv_row["he_dao_tao"] or "").strip()
    return "CLC" if h == "CLC" else "DaiTra"


def dot_matches_student(conn, dot_id, sv_row):
    try:
        did = int(dot_id)
    except (TypeError, ValueError):
        return False, "dot_id không hợp lệ"
    dot = conn.execute("SELECT * FROM dot WHERE id = ?", (did,)).fetchone()
    if not dot:
        return False, "Không có đợt đăng ký này"
    dot_nganh = (dot["nganh"] or "").strip()
    if dot_nganh:
        majors = _sv_majors_from_row(sv_row)
        if majors and dot_nganh not in majors:
            return False, "Đợt không khớp ngành/chuyên ngành của bạn"
    return True, None


def map_status_for_ui(loai, trang_thai):
    if loai == "BCTT":
        if trang_thai == "dong_y":
            return "gv_xac_nhan"
    if loai == "KLTN":
        if trang_thai == "dong_y":
            return "thuc_hien"
    return trang_thai


def now_date_string():
    return datetime.now().strftime("%Y-%m-%d")
