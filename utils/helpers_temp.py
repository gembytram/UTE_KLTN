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
        return {"mangDeTai": "", "tenCongTy": "", "topicType": "", "moTa": ""}
    if "||" not in value:
        return {"mangDeTai": value, "tenCongTy": "", "topicType": "", "moTa": ""}

    parts = [part.strip() for part in value.split("||")]
    mang = parts[0] if len(parts) > 0 else ""
    
    # Handle 4-part BCTT format: linh_vuc||ten_cong_ty||mo_ta||topic_type
    if len(parts) == 4:
        return {
            "mangDeTai": mang,
            "tenCongTy": parts[1] if len(parts) > 1 else "",
            "moTa": parts[2] if len(parts) > 2 else "",
            "topicType": parts[3] if len(parts) > 3 else "",
        }
    
    # Handle 2-part format: linh_vuc||topic_type or linh_vuc||ten_cong_ty
    if len(parts) == 2:
        second = parts[1]
        if second in ("ung_dung", "nghien_cuu"):
            return {"mangDeTai": mang, "tenCongTy": "", "topicType": second, "moTa": ""}
        return {"mangDeTai": mang, "tenCongTy": second, "topicType": "", "moTa": ""}
    
    # Handle 3-part old BCTT format: linh_vuc||ten_cong_ty||topic_type
    return {
        "mangDeTai": mang,
        "tenCongTy": parts[1] if len(parts) > 1 else "",
        "topicType": parts[2] if len(parts) > 2 else "",
        "moTa": "",
    }


def build_bctt_meta(linh_vuc, ten_cong_ty="", mo_ta=""):
    """Build BCTT metadata: linh_vuc||ten_cong_ty||mo_ta||topic_type (empty for BCTT)"""
    return "||".join([
        (linh_vuc or "").strip(),
        (ten_cong_ty or "").strip(),
        (mo_ta or "").strip(),
        "",  # topic_type is empty for BCTT
    ])


def build_kltn_meta(linh_vuc, topic_type=""):
    topic = (topic_type or "").strip()
    if not topic:
        return (linh_vuc or "").strip()
    return "||".join([(linh_vuc or "").strip(), topic])


def _sv_majors_from_row(sv_row):
    lv = sv_row["linh_vuc"] or ""
    return [x.strip() for x in lv.split(",") if x.strip()]


def _user_majors(user_row):
    lv = user_row["linh_vuc"] or ""
    return [x.strip() for x in lv.split(",") if x.strip()]


def user_has_common_major(user_row, majors_list):
    user_majors = set(_user_majors(user_row))
    majors_list = [m.strip().lower() for m in majors_list if m.strip()]
    return any(um.lower() in majors_list for um in user_majors)


def assert_kltn_assignees_match_major(conn, dang_ky_id, required_major):
    dk = conn.execute("SELECT * FROM dang_ky WHERE id = ?", (dang_ky_id,)).fetchone()
    if not dk:
        return None, "Không tìm dang_ky"
    gv_hd = conn.execute("SELECT * FROM users WHERE id = ?", (dk["gv_id"],)).fetchone()
    if not gv_hd or not user_has_common_major(gv_hd, [required_major]):
        return None, "GVHD không thuộc ngành"
    return dk, None


def dot_matches_student(conn, dot_id, sv_row):
    dot = conn.execute("SELECT * FROM dot WHERE id = ?", (dot_id,)).fetchone()
    if not dot:
        return False, "Không tìm đợt"
    sv_he = normalize_sv_slot_he(sv_row)
    dot_he = (dot["he_dao_tao"] or "").strip() or "DaiTra"
    if dot_he and sv_he != dot_he:
        return False, f"Hệ không khớp (SV: {sv_he}, Đợt: {dot_he})"
    return True, None


def normalize_sv_slot_he(sv_row):
    """Normalize student he_dao_tao to slot he (DaiTra or CLC)."""
    raw = (sv_row.get("he_dao_tao") or "").strip() or "DaiTra"
    return "CLC" if "CLC" in raw.upper() else "DaiTra"


def normalize_he(he_raw):
    """Normalize từ bảng tính về DaiTra/CLC."""
    if not he_raw:
        return "DaiTra"
    he_upper = str(he_raw or "").strip().upper()
    if "CLC" in he_upper or "CHẤT" in he_upper or "NÂNG CAO" in he_upper:
        return "CLC"
    return "DaiTra"


def kltn_major_from_dang_ky(meta):
    parts = [p.strip() for p in (meta or "").split("||")]
    return parts[0] if parts else ""


def map_status_for_ui(loai, trang_thai):
    status_map = {
        "cho_duyet": "waiting",
        "gv_xac_nhan": "gv_approved",
        "cho_cham": "grading",
        "pass": "pass",
        "fail": "fail",
        "thuc_hien": "in_progress",
        "cham_diem": "scoring",
        "bao_ve": "defense",
        "hoan_thanh": "completed",
    }
    return status_map.get(trang_thai, trang_thai)


def now_date_string():
    return datetime.now().strftime("%d/%m/%Y %H:%M")
