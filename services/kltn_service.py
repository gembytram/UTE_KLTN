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


def _can_score_kltn(conn, dang_ky_id, gv_id, vai_tro):
    reg = conn.execute("SELECT gv_id, loai FROM dang_ky WHERE id = ?", (dang_ky_id,)).fetchone()
    if not reg or reg["loai"] != "KLTN":
        return False
    if vai_tro == "HD":
        return reg["gv_id"] == gv_id
    if vai_tro == "PB":
        row = conn.execute(
            """
            SELECT file_path FROM nop_bai
            WHERE dang_ky_id = ? AND loai_file = 'phanbien_gv'
            ORDER BY id DESC LIMIT 1
            """,
            (dang_ky_id,),
        ).fetchone()
        return row and str(row["file_path"]) == str(gv_id)
    hd = _hoi_dong_ids(conn, dang_ky_id)
    if not hd:
        return False
    if vai_tro == "CT":
        return hd["ct"] == gv_id
    if vai_tro == "TV":
        return gv_id in hd["tv"]
    return False
