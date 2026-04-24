from utils.helpers import (
    build_email,
    map_role,
    map_status_for_ui,
    now_date_string,
    parse_linh_vuc,
)
from services.kltn_service import _kltn_assignment


def serialize_user(row):
    return {
        "id": row["id"],
        "ma": row["ma"],
        "email": build_email(row["ma"]),
        "ho_ten": row["ho_ten"],
        "name": row["ho_ten"],
        "role_raw": row["role"],
        "role": map_role(row["role"]),
        "linh_vuc": row["linh_vuc"] or "",
        "heDaoTao": (row["he_dao_tao"] or "").strip(),
    }


def fetch_bootstrap(conn):
    users = conn.execute("SELECT * FROM users ORDER BY id ASC").fetchall()
    dots = conn.execute("SELECT * FROM dot ORDER BY id ASC").fetchall()
    slots = conn.execute("SELECT * FROM gv_slot ORDER BY id ASC").fetchall()
    regs = conn.execute(
        """
        SELECT dk.*, sv.ma AS sv_ma, gv.ma AS gv_ma, d.ten_dot AS ten_dot
        FROM dang_ky dk
        JOIN users sv ON sv.id = dk.sv_id
        JOIN users gv ON gv.id = dk.gv_id
        JOIN dot d ON d.id = dk.dot_id
        ORDER BY dk.id DESC
        """
    ).fetchall()
    scores = conn.execute("SELECT * FROM cham_diem ORDER BY id ASC").fetchall()
    uploads = conn.execute("SELECT * FROM nop_bai ORDER BY uploaded_at DESC").fetchall()

    user_map = {u["id"]: serialize_user(u) for u in users}
    gv_slots_payload = []
    for s in slots:
        hek = (s["he_dao_tao"] or "").strip() or "DaiTra"
        gv_slots_payload.append(
            {
                "id": s["id"],
                "gvId": s["gv_id"],
                "dotId": str(s["dot_id"]),
                "heDaoTao": hek,
                "slotConLai": s["slot_con_lai"],
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
            "svEmail": build_email(r["sv_ma"]),
            "tenDot": r["ten_dot"] if "ten_dot" in r.keys() else "",
            "tenDeTai": r["ten_de_tai"],
            "mangDeTai": meta["mangDeTai"],
            "gvEmail": build_email(r["gv_ma"]),
            "gvHDEmail": build_email(r["gv_ma"]),
            "dotId": str(r["dot_id"]),
            "trangThai": map_status_for_ui(r["loai"], r["trang_thai"]),
            "ngayDangKy": now_date_string(),
        }
        if r["loai"] == "BCTT":
            sc_bctt = score_map.get(r["id"], {}).get("BCTT")
            record["tenCongTy"] = meta["tenCongTy"]
            record["fileBC"] = upload_map.get(r["id"], {}).get("bctt_baocao")
            record["fileXacNhan"] = upload_map.get(r["id"], {}).get("bctt_xacnhan")
            record["fileTurnitinBCTT"] = upload_map.get(r["id"], {}).get("turnitin_bctt")
            record["diemBCTT"] = sc_bctt["diem"] if sc_bctt else None
            record["nhanXetBCTT"] = sc_bctt["nhan_xet"] if sc_bctt else ""
            bctt_list.append(record)
        else:
            sc = score_map.get(r["id"], {})
            assignment = _kltn_assignment(conn, r["id"]) or {}
            pb_raw = upload_map.get(r["id"], {}).get("phanbien_gv")
            gv_pb_email = None
            if pb_raw:
                try:
                    pb_user = user_map.get(int(pb_raw))
                    gv_pb_email = pb_user["email"] if pb_user else None
                except ValueError:
                    gv_pb_email = None
            hoi_dong_raw = upload_map.get(r["id"], {}).get("hoi_dong")
            hoi_dong = None
            if hoi_dong_raw:
                ids = [int(id_str) for id_str in hoi_dong_raw.split("|") if id_str.isdigit()]
                if len(ids) >= 3:
                    ct_user = user_map.get(ids[0])
                    tk_user = user_map.get(ids[1])
                    tv_users = [user_map.get(uid) for uid in ids[2:]]
                    if ct_user and tk_user and all(tv_users):
                        hoi_dong = {
                            "ct": ct_user["email"],
                            "tk": tk_user["email"],
                            "tv": [u["email"] for u in tv_users],
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
            record["diemPB"] = sc["PB"]["diem"] if sc.get("PB") else None
            record["diemBB"] = sc["CT"]["diem"] if sc.get("CT") else None
            pb_row = sc.get("PB")
            record["pbNote"] = (pb_row["nhan_xet"] or "") if pb_row else ""
            record["pbCauHoi"] = (pb_row["cau_hoi"] or "") if pb_row else ""
            ct_row = sc.get("CT")
            record["ctNote"] = (ct_row["nhan_xet"] or "") if ct_row else ""
            record["ctCauHoi"] = (ct_row["cau_hoi"] or "") if ct_row else ""
            record["bbNote"] = record["ctNote"]
            record["tkBienBan"] = upload_map.get(r["id"], {}).get("bien_ban_tk") or ""
            record["bienBanChamDiem"] = upload_map.get(r["id"], {}).get("bien_ban_cham_diem") or ""
            record["hdNote"] = sc["HD"]["nhan_xet"] if sc.get("HD") else ""
            record["xacNhanGVHD"] = bool(upload_map.get(r["id"], {}).get("xac_nhan_gvhd"))
            record["xacNhanCTHD"] = bool(upload_map.get(r["id"], {}).get("xac_nhan_cthd"))
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
                        }
                    )
            kltn_list.append(record)

    bctt_dots = [d for d in dots if d["loai"] == "BCTT"]
    open_bctt_dot_ids = [d["id"] for d in bctt_dots if d["trang_thai"] == "mo"]

    def gv_bctt_open_slots_aggregate(gv_uid):
        user_slots = [s for s in slots if s["gv_id"] == gv_uid]
        bctt_open = [s for s in user_slots if s["dot_id"] in open_bctt_dot_ids]
        if not bctt_open:
            return None
        return {
            "slot_con_lai": sum(s["slot_con_lai"] for s in bctt_open),
            "quota": sum(s["quota"] for s in bctt_open),
            "duyet_tbm": all(bool(s["duyet_tbm"]) for s in bctt_open),
        }

    mapped_users = []
    for u in users:
        role = map_role(u["role"])
        user_data = {
            "id": u["id"],
            "ma": u["ma"],
            "email": build_email(u["ma"]),
            "password": u["mat_khau"],
            "name": u["ho_ten"],
            "role": role,
            "mssv": u["ma"] if role == "sv" else None,
            "msgv": u["ma"] if role in ("gv", "bm") else None,
            "khoa": "",
            "chuyenMon": [x.strip() for x in (u["linh_vuc"] or "").split(",") if x.strip()],
            "heDaoTao": (u["he_dao_tao"] or "").strip(),
        }
        if role in ("gv", "bm"):
            agg = gv_bctt_open_slots_aggregate(u["id"])
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
        "dotDangKy": dot_data,
        "bcttList": bctt_list,
        "kltnList": kltn_list,
        "gvSlots": gv_slots_payload,
    }
