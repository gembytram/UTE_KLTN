import json as _json_mod

from utils.helpers import (
    build_email,
    map_role,
    map_status_for_ui,
    now_date_string,
    parse_linh_vuc,
)
from services.kltn_service import _kltn_assignment


def serialize_user(row):
    email = (row["gmail"] or "").strip() if "gmail" in row.keys() else ""
    if not email:
        email = build_email(row["ma"])
    return {
        "id": row["id"],
        "ma": row["ma"],
        "email": email,
        "gmail": email,
        "ho_ten": row["ho_ten"],
        "name": row["ho_ten"],
        "role_raw": row["role"],
        "role": map_role(row["role"]),
        "linh_vuc": row["linh_vuc"] or "",
        "linh_vuc_phu_trach": row["linh_vuc_phu_trach"] or "",
        "heDaoTao": (row["he_dao_tao"] or "").strip(),
    }


def fetch_bootstrap(conn):
    users = conn.execute("SELECT * FROM users ORDER BY id ASC").fetchall()
    fields = conn.execute("SELECT id, ten FROM linh_vuc_phu_trach ORDER BY ten ASC").fetchall()
    user_field_rows = conn.execute(
        """
        SELECT uf.user_id, uf.field_id, f.ten
        FROM user_linh_vuc_phu_trach uf
        JOIN linh_vuc_phu_trach f ON f.id = uf.field_id
        ORDER BY uf.user_id ASC, f.ten ASC
        """
    ).fetchall()
    dots = conn.execute("SELECT * FROM dot ORDER BY id ASC").fetchall()
    slots = conn.execute("SELECT * FROM gv_slot ORDER BY id ASC").fetchall()
    regs = conn.execute(
        """
        SELECT dk.*, sv.ma AS sv_ma, gv.ma AS gv_ma, d.ten_dot AS ten_dot,
               hd.ten AS hd_ten, hd.thoi_gian AS hd_thoi_gian, hd.phong AS hd_phong
        FROM dang_ky dk
        JOIN users sv ON sv.id = dk.sv_id
        JOIN users gv ON gv.id = dk.gv_id
        JOIN dot d ON d.id = dk.dot_id
        LEFT JOIN hoi_dong hd ON hd.id = dk.hoi_dong_id
        ORDER BY dk.id DESC
        """
    ).fetchall()
    scores = conn.execute("SELECT * FROM cham_diem ORDER BY id ASC").fetchall()
    uploads = conn.execute("SELECT * FROM nop_bai ORDER BY uploaded_at DESC").fetchall()
    hoi_dong_rows = conn.execute("SELECT * FROM hoi_dong ORDER BY id ASC").fetchall()

    user_map = {u["id"]: serialize_user(u) for u in users}
    
    # Count all active BCTT/KLTN assignments by lecturer, dot, and training type
    active_slot_assignments = {}
    for reg in regs:
        if reg["loai"] not in ("BCTT", "KLTN"):
            continue
        sv = user_map.get(reg["sv_id"])
        if not sv:
            continue
        he = "CLC" if str(sv.get("heDaoTao") or "").strip() == "CLC" else "DaiTra"
        key = (reg["gv_id"], reg["dot_id"], he)
        active_slot_assignments[key] = active_slot_assignments.get(key, 0) + 1

    def compute_slot_remaining(slot):
        hek = (slot["he_dao_tao"] or "").strip() or "DaiTra"
        used = active_slot_assignments.get((slot["gv_id"], slot["dot_id"], hek), 0)
        return max(0, int(slot["quota"] or 0) - used)

    # Process hoi_dong data
    hoi_dong_list = []
    for hd in hoi_dong_rows:
        try:
            tv_ids = _json_mod.loads(hd["tv_ids"] or "[]")
        except:
            tv_ids = []
        
        hoi_dong_list.append({
            "id": str(hd["id"]),
            "ten": hd["ten"],
            "nguoiTaoEmail": user_map.get(hd["nguoi_tao_id"], {}).get("email", ""),
            "ct": user_map.get(hd["chu_tich_id"], {}).get("email", "") if hd["chu_tich_id"] else "",
            "tk": user_map.get(hd["thu_ky_id"], {}).get("email", "") if hd["thu_ky_id"] else "",
            "pb": user_map.get(hd["gv_pb_id"], {}).get("email", "") if hd["gv_pb_id"] else "",
            "tv": [user_map.get(uid, {}).get("email", "") for uid in tv_ids if uid in user_map],
            "thoiGian": hd["thoi_gian"],
            "phong": hd["phong"] or "",
        })
    gv_slots_payload = []
    for s in slots:
        hek = (s["he_dao_tao"] or "").strip() or "DaiTra"
        gv_slots_payload.append(
            {
                "id": s["id"],
                "gvId": s["gv_id"],
                "dotId": str(s["dot_id"]),
                "heDaoTao": hek,
                "slotConLai": compute_slot_remaining(s),
                "quota": s["quota"],
                "duyetTbm": bool(s["duyet_tbm"]),
            }
        )

    dot_data = []
    for d in dots:
        dot_data.append(
            {
                "id": str(d["id"]),
                "ten": d["ten_dot"],
                "loai": d["loai"],
                "trangThai": "dang_mo" if d["trang_thai"] == "mo" else "dong",
                "batDau": d["han_dang_ky"],
                "ketThuc": d["han_nop"],
                "heDaoTao": (d["he_dao_tao"] or "").strip(),
                "nganh": (d["nganh"] or "").strip(),
            }
        )

    def parse_score_criteria(score_row):
        if not score_row:
            return []
        try:
            criteria = _json_mod.loads(score_row.get("criteria_json") or "[]")
            return criteria if isinstance(criteria, list) else []
        except Exception:
            return []

    score_map = {}
    tv_scores_by_dk = {}
    for s in scores:
        score_map.setdefault(s["dang_ky_id"], {})[s["vai_tro"]] = s
        if s["vai_tro"] == "TV":
            tv_scores_by_dk.setdefault(s["dang_ky_id"], []).append(s)

    upload_map = {}
    for u in uploads:
        dk = u["dang_ky_id"]
        lf = u["loai_file"]
        upload_map.setdefault(dk, {})
        if lf not in upload_map[dk]:
            upload_map[dk][lf] = u["file_path"]

    bctt_list = []
    kltn_list = []
    for r in regs:
        meta = parse_linh_vuc(r["linh_vuc"])
        record = {
            "id": f"{r['loai'].lower()}{r['id']}",
            "dangKyId": r["id"],
            "svEmail": user_map.get(r["sv_id"], {}).get("email") or build_email(r["sv_ma"]),
            "svMa": r["sv_ma"],
            "tenDot": r["ten_dot"] if "ten_dot" in r.keys() else "",
            "tenDeTai": r["ten_de_tai"],
            "mangDeTai": meta["mangDeTai"],
            "topicType": meta["topicType"],
            "gvEmail": user_map.get(r["gv_id"], {}).get("email") or build_email(r["gv_ma"]),
            "gvHDEmail": user_map.get(r["gv_id"], {}).get("email") or build_email(r["gv_ma"]),
            "dotId": str(r["dot_id"]),
            "trangThai": map_status_for_ui(r["loai"], r["trang_thai"]),
            "ngayDangKy": now_date_string(),
        }
        if r["loai"] == "BCTT":
            sc_bctt = score_map.get(r["id"], {}).get("BCTT")
            record["tenCongTy"] = meta.get("tenCongTy", "")
            record["moTa"] = meta.get("moTa", "")
            record["fileBC"] = upload_map.get(r["id"], {}).get("bctt_baocao")
            record["fileBCWord"] = upload_map.get(r["id"], {}).get("bctt_baocao_word")
            record["fileXacNhan"] = upload_map.get(r["id"], {}).get("bctt_xacnhan")
            record["fileTurnitinBCTT"] = upload_map.get(r["id"], {}).get("turnitin_bctt")
            record["diemBCTT"] = sc_bctt["diem"] if sc_bctt else None
            record["nhanXetBCTT"] = sc_bctt["nhan_xet"] if sc_bctt else ""
            record["submittedLate"] = bool(r["submitted_late"]) if "submitted_late" in r.keys() else False
            record["submittedAt"] = r["submitted_at"] if "submitted_at" in r.keys() else None
            bctt_list.append(record)
        else:
            sc = score_map.get(r["id"], {})
            # Get assignments from dang_ky table
            gv_pb_id = r["gv_pb_id"]
            chu_tich_id = r["chu_tich_id"]
            thu_ky_id = r["thu_ky_id"]
            try:
                gv_pb_id = int(r["gv_pb_id"]) if r["gv_pb_id"] is not None else None
            except (TypeError, ValueError):
                gv_pb_id = None
            try:
                chu_tich_id = int(r["chu_tich_id"]) if r["chu_tich_id"] is not None else None
            except (TypeError, ValueError):
                chu_tich_id = None
            try:
                thu_ky_id = int(r["thu_ky_id"]) if r["thu_ky_id"] is not None else None
            except (TypeError, ValueError):
                thu_ky_id = None
            uy_vien_ids = r["uy_vien_ids"] or "[]"
            uy_vien_list = []
            try:
                raw_list = _json_mod.loads(uy_vien_ids) if uy_vien_ids else []
                uy_vien_list = [int(uid) for uid in raw_list if str(uid).isdigit()]
            except Exception:
                uy_vien_list = []
            assignment = {
                "advisor_id": r["gv_id"],
                "reviewer_id": gv_pb_id,
                "chairman_id": chu_tich_id,
                "secretary_id": thu_ky_id,
                "committee_members": uy_vien_list,
            }
            gv_pb_email = user_map.get(gv_pb_id, {}).get("email") if gv_pb_id else None
            hoi_dong = None
            if r.get("hoi_dong_id") and chu_tich_id and thu_ky_id:
                ct_user = user_map.get(chu_tich_id)
                tk_user = user_map.get(thu_ky_id)
                tv_users = [user_map.get(uid) for uid in uy_vien_list if uid in user_map]
                pb_user = user_map.get(gv_pb_id) if gv_pb_id else None
                if ct_user and tk_user:
                    hoi_dong = {
                        "id": str(r["hoi_dong_id"]),
                        "tenHD": r.get("hd_ten"),
                        "ct": ct_user["email"],
                        "tk": tk_user["email"],
                        "tv": [u["email"] for u in tv_users] if tv_users else [],
                        "pb": pb_user["email"] if pb_user else None,
                        "thoiGian": r.get("hd_thoi_gian"),
                        "phong": r.get("hd_phong"),
                    }
            record["gvPBEmail"] = gv_pb_email
            record["advisorId"] = assignment.get("advisor_id")
            record["reviewerId"] = assignment.get("reviewer_id")
            record["chairmanId"] = assignment.get("chairman_id")
            record["secretaryId"] = assignment.get("secretary_id")
            record["committeeMembers"] = assignment.get("committee_members") or []
            record["committeeMemberEmails"] = [
                user_map[uid]["email"] for uid in record["committeeMembers"] if uid in user_map
            ]
            record["pbAccepted"] = bool(upload_map.get(r["id"], {}).get("pb_accepted"))
            record["hoiDong"] = hoi_dong
            file_map = upload_map.get(r["id"], {})
            record["fileBai"] = file_map.get("kltn_bai_pdf") or file_map.get("kltn_bai")
            record["fileBaiWord"] = file_map.get("kltn_bai_word")
            record["fileTurnitin"] = upload_map.get(r["id"], {}).get("turnitin")
            record["fileBaiChinhSua"] = upload_map.get(r["id"], {}).get("kltn_chinhsua")
            record["fileGiaiTrinh"] = upload_map.get(r["id"], {}).get("bien_ban_giai_trinh")
            record["diemHD"] = sc["HD"]["diem"] if sc.get("HD") else None
            record["hdCriteria"] = parse_score_criteria(sc.get("HD"))
            record["diemPB"] = sc["PB"]["diem"] if sc.get("PB") else None
            record["pbCriteria"] = parse_score_criteria(sc.get("PB"))
            record["diemBB"] = sc["CT"]["diem"] if sc.get("CT") else None
            record["ctCriteria"] = parse_score_criteria(sc.get("CT"))
            pb_row = sc.get("PB")
            record["pbNote"] = (pb_row["nhan_xet"] or "") if pb_row else ""
            record["submittedLate"] = bool(r["submitted_late"]) if "submitted_late" in r.keys() else False
            record["submittedAt"] = r["submitted_at"] if "submitted_at" in r.keys() else None
            record["pbCauHoi"] = (pb_row["cau_hoi"] or "") if pb_row else ""
            ct_row = sc.get("CT")
            record["ctNote"] = (ct_row["nhan_xet"] or "") if ct_row else ""
            record["ctCauHoi"] = (ct_row["cau_hoi"] or "") if ct_row else ""
            record["bbNote"] = record["ctNote"]
            record["tkBienBan"] = upload_map.get(r["id"], {}).get("bien_ban_tk") or ""
            record["bienBanChamDiem"] = upload_map.get(r["id"], {}).get("bien_ban_cham_diem") or ""
            # Loại bỏ nhận xét từ GVHD theo yêu cầu refactor
            # record["hdNote"] = sc["HD"]["nhan_xet"] if sc.get("HD") else ""
            record["xacNhanGVHD"] = bool(upload_map.get(r["id"], {}).get("xac_nhan_gvhd"))
            record["xacNhanCTHD"] = bool(upload_map.get(r["id"], {}).get("xac_nhan_cthd"))
            record["gvhdApproved"] = record["xacNhanGVHD"]
            record["cthdApproved"] = record["xacNhanCTHD"]
            record["tuChoiGVHD"] = upload_map.get(r["id"], {}).get("tu_choi_gvhd")
            record["tuChoiCTHD"] = upload_map.get(r["id"], {}).get("tu_choi_cthd")
            record["tvScores"] = []
            for s in tv_scores_by_dk.get(r["id"], []):
                gu = user_map.get(s["gv_id"])
                if gu:
                    record["tvScores"].append(
                        {
                            "email": gu["email"],
                            "diem": s["diem"],
                            "nhanXet": s["nhan_xet"] or "",
                            "criteria": parse_score_criteria(s),
                        }
                    )
            kltn_list.append(record)

    open_dot_ids = [d["id"] for d in dots if d["trang_thai"] == "mo"]

    def gv_open_slots_aggregate(gv_uid):
        user_slots = [s for s in slots if s["gv_id"] == gv_uid]
        open_slots = [s for s in user_slots if s["dot_id"] in open_dot_ids]
        if not open_slots:
            return None
        return {
            "slot_con_lai": sum(compute_slot_remaining(s) for s in open_slots),
            "quota": sum(s["quota"] for s in open_slots),
            "duyet_tbm": all(bool(s["duyet_tbm"]) for s in open_slots),
        }

    user_field_map = {}
    for row in user_field_rows:
        user_field_map.setdefault(row["user_id"], []).append(
            {"id": row["field_id"], "ten": row["ten"]}
        )

    mapped_users = []
    for u in users:
        role = map_role(u["role"])
        user_fields = user_field_map.get(u["id"], [])
        field_names = [f["ten"] for f in user_fields]
        field_ids = [f["id"] for f in user_fields]
        linh_vuc_phu_trach_text = ", ".join(field_names) if field_names else (u["linh_vuc_phu_trach"] or "").strip()
        user_data = {
            "id": u["id"],
            "ma": u["ma"],
            "email": (u["gmail"] or "").strip() or build_email(u["ma"]),
            "gmail": (u["gmail"] or "").strip(),
            "password": u["mat_khau"],
            "name": u["ho_ten"],
            "role": role,
            "mssv": u["ma"] if role == "sv" else None,
            "msgv": u["ma"] if role in ("gv", "bm") else None,
            "khoa": "Kinh tế",
            "chuyenMon": [x.strip() for x in (u["linh_vuc"] or "").split(",") if x.strip()],
            "linhVucPhuTrach": linh_vuc_phu_trach_text,
            "linh_vuc_phu_trach": linh_vuc_phu_trach_text,
            "linhVucPhuTrachList": field_names,
            "linhVucPhuTrachIds": field_ids,
            "heDaoTao": (u["he_dao_tao"] or "").strip(),
        }
        if role in ("gv", "bm"):
            agg = gv_open_slots_aggregate(u["id"])
            user_data["quota"] = agg["slot_con_lai"] if agg else 0
            user_data["quota_max"] = agg["quota"] if agg else 0
            user_data["slot_con_lai"] = agg["slot_con_lai"] if agg else 0
            user_data["slotOpen"] = agg["duyet_tbm"] if agg else True
        else:
            user_data["quota"] = 0
            user_data["quota_max"] = 0
            user_data["slot_con_lai"] = 0
            user_data["slotOpen"] = True
        mapped_users.append(user_data)

    return {
        "users": mapped_users,
        "fields": [{"id": f["id"], "ten": f["ten"]} for f in fields],
        "dotDangKy": dot_data,
        "bcttList": bctt_list,
        "kltnList": kltn_list,
        "gvSlots": gv_slots_payload,
        "hoiDongList": hoi_dong_list,
    }
