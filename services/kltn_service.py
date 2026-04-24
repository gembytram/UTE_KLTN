def _hoi_dong_ids(conn, dang_ky_id):
    row = conn.execute(
        """
        SELECT file_path FROM nop_bai
        WHERE dang_ky_id = ? AND loai_file = 'hoi_dong'
        ORDER BY id DESC LIMIT 1
        """,
        (dang_ky_id,),
    ).fetchone()
    if not row or not row["file_path"]:
        return None
    ids = [int(x) for x in row["file_path"].split("|") if x.strip().isdigit()]
    if len(ids) < 3:
        return None
    return {"ct": ids[0], "tk": ids[1], "tv": ids[2:]}


def _reviewer_id(conn, dang_ky_id):
    row = conn.execute(
        """
        SELECT file_path FROM nop_bai
        WHERE dang_ky_id = ? AND loai_file = 'phanbien_gv'
        ORDER BY id DESC LIMIT 1
        """,
        (dang_ky_id,),
    ).fetchone()
    if not row or row["file_path"] is None:
        return None
    try:
        return int(str(row["file_path"]).strip())
    except (TypeError, ValueError):
        return None


def _kltn_assignment(conn, dang_ky_id):
    reg = conn.execute("SELECT gv_id, loai FROM dang_ky WHERE id = ?", (dang_ky_id,)).fetchone()
    if not reg or reg["loai"] != "KLTN":
        return None
    hoi_dong = _hoi_dong_ids(conn, dang_ky_id) or {"ct": None, "tk": None, "tv": []}
    return {
        "dang_ky_id": dang_ky_id,
        "advisor_id": reg["gv_id"],
        "reviewer_id": _reviewer_id(conn, dang_ky_id),
        "chairman_id": hoi_dong["ct"],
        "secretary_id": hoi_dong["tk"],
        "committee_members": hoi_dong["tv"],
    }


def can_grade(gv_id, student):
    if not student:
        return False
    advisor_id = student.get("advisor_id")
    reviewer_id = student.get("reviewer_id")
    committee_members = student.get("committee_members") or []
    return gv_id in {advisor_id, reviewer_id} or gv_id in committee_members


def can_view_kltn(gv_id, student):
    if can_grade(gv_id, student):
        return True
    if not student:
        return False
    return gv_id in {student.get("chairman_id"), student.get("secretary_id")}


def _can_score_kltn(conn, dang_ky_id, gv_id, vai_tro):
    assignment = _kltn_assignment(conn, dang_ky_id)
    if not assignment:
        return False
    if vai_tro == "HD":
        return assignment["advisor_id"] == gv_id
    if vai_tro == "PB":
        return assignment["reviewer_id"] == gv_id
    if vai_tro == "TV":
        return gv_id in (assignment["committee_members"] or [])
    return False
