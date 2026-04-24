import base64
import json as _json_mod
import os
import subprocess
import tempfile
from datetime import datetime

from flask import after_this_request, request, send_from_directory, session
from werkzeug.utils import secure_filename

from config.settings import UPLOAD_FOLDER
from database import get_db
from services.auth import get_current_user, login_required, role_required
from services.bootstrap_service import fetch_bootstrap, serialize_user
from services.kltn_service import _can_score_kltn, _hoi_dong_ids, can_view_kltn
from utils.helpers import (
    assert_kltn_assignees_match_major,
    build_bctt_meta,
    build_kltn_meta,
    dot_matches_student,
    kltn_major_from_dang_ky,
    normalize_sv_slot_he,
    user_has_common_major,
)
from utils.response import fail, ok, send_file_response


def register_routes(app):
    @app.errorhandler(413)
    def file_too_large(_):
        return fail("File vượt quá 20MB", 400)

    @app.route("/")
    def index():
        return send_from_directory(os.path.join(app.root_path, "frontend"), "index.html")

    @app.route("/<path:filename>")
    def static_files(filename):
        return send_from_directory(os.path.join(app.root_path, "frontend"), filename)

    @app.route("/api/login", methods=["POST"])
    def login():
        data = request.json or {}
        ma = (data.get("ma") or "").strip()
        mat_khau = data.get("mat_khau")
        if not ma or not mat_khau:
            return fail("Thiếu mã đăng nhập hoặc mật khẩu", 400)

        conn = get_db()
        user = conn.execute(
            "SELECT * FROM users WHERE ma = ? AND mat_khau = ?",
            (ma.upper(), mat_khau),
        ).fetchone()
        conn.close()
        if not user:
            return fail("Sai tên đăng nhập hoặc mật khẩu", 401)

        session["user_id"] = user["id"]
        session["role"] = user["role"]
        return ok("Đăng nhập thành công", {"user": serialize_user(user)})

    @app.route("/api/logout", methods=["POST"])
    def logout():
        session.clear()
        return ok("Đăng xuất thành công")

    @app.route("/api/me", methods=["GET"])
    @login_required
    def me():
        conn = get_db()
        user = get_current_user(conn)
        conn.close()
        return ok("Lấy thông tin phiên đăng nhập", {"user": serialize_user(user)})

    @app.route("/api/me/password", methods=["POST"])
    @login_required
    def change_my_password():
        data = request.json or {}
        old_password = data.get("old_password") or data.get("mat_khau_cu")
        new_password = data.get("new_password") or data.get("mat_khau_moi")
        confirm_password = data.get("confirm_password") or data.get("xac_nhan_mat_khau")

        if old_password is None or new_password is None:
            return fail("Thiếu mật khẩu hiện tại hoặc mật khẩu mới", 400)

        old_password = str(old_password)
        new_password = str(new_password)
        confirm_password = str(confirm_password) if confirm_password is not None else None

        if confirm_password is not None and new_password != confirm_password:
            return fail("Mật khẩu xác nhận không khớp", 400)
        if len(new_password) < 6:
            return fail("Mật khẩu tối thiểu 6 ký tự", 400)

        conn = get_db()
        user = get_current_user(conn)
        if not user:
            conn.close()
            return fail("Không tìm thấy người dùng", 401)
        if str(user["mat_khau"]) != old_password:
            conn.close()
            return fail("Mật khẩu hiện tại không đúng", 400)
        if old_password == new_password:
            conn.close()
            return fail("Mật khẩu mới phải khác mật khẩu hiện tại", 400)

        conn.execute(
            "UPDATE users SET mat_khau = ? WHERE id = ?",
            (new_password, user["id"]),
        )
        conn.commit()
        conn.close()
        return ok("Cập nhật mật khẩu thành công")

    @app.route("/api/bootstrap", methods=["GET"])
    @login_required
    def bootstrap():
        conn = get_db()
        data = fetch_bootstrap(conn)

        role = session.get("role") or request.headers.get("X-User-Role", "")
        uid = session.get("user_id") or request.headers.get("X-User-Id")
        try:
            current_uid = int(uid) if uid is not None else None
        except (TypeError, ValueError):
            current_uid = None

        if str(role).upper() == "GV" and current_uid is not None:
            data["kltnList"] = [
                k
                for k in data["kltnList"]
                if can_view_kltn(
                    current_uid,
                    {
                        "advisor_id": k.get("advisorId"),
                        "reviewer_id": k.get("reviewerId"),
                        "chairman_id": k.get("chairmanId"),
                        "secretary_id": k.get("secretaryId"),
                        "committee_members": k.get("committeeMembers") or [],
                    },
                )
            ]

        if str(role).upper() == "TBM":
            tbm = conn.execute("SELECT linh_vuc FROM users WHERE id = ?", (uid,)).fetchone()
            if tbm and tbm["linh_vuc"]:
                nganh_list = [x.strip() for x in tbm["linh_vuc"].split(",") if x.strip()]

                def thuoc_nganh(ten_dot):
                    return any(n in (ten_dot or "") for n in nganh_list)

                data["bcttList"] = [b for b in data["bcttList"] if thuoc_nganh(b.get("tenDot", ""))]
                data["kltnList"] = [k for k in data["kltnList"] if thuoc_nganh(k.get("tenDot", ""))]

        conn.close()
        return ok("Lấy dữ liệu giao diện", data)

    @app.route("/api/bctt/register", methods=["POST"])
    @role_required("SV")
    def register_bctt():
        data = request.json or {}
        ten = (data.get("ten_de_tai") or "").strip()
        linh_vuc = (data.get("linh_vuc") or "").strip()
        cong_ty = (data.get("ten_cong_ty") or "").strip()
        loai_de_tai = (data.get("loai_de_tai") or "").strip()
        gv_id = data.get("gv_id")
        dot_id = data.get("dot_id")
        if not all([ten, linh_vuc, cong_ty, loai_de_tai, gv_id, dot_id]):
            return fail("Thiếu thông tin đăng ký BCTT", 400)
        if loai_de_tai not in ("ung_dung", "nghien_cuu"):
            return fail("Loại đề tài BCTT không hợp lệ", 400)

        conn = get_db()
        sv = get_current_user(conn)
        exists = conn.execute(
            "SELECT id FROM dang_ky WHERE sv_id = ? AND loai = 'BCTT'",
            (sv["id"],),
        ).fetchone()
        if exists:
            conn.close()
            return fail("Bạn đã đăng ký BCTT", 400)

        ok_dot, dot_err = dot_matches_student(conn, dot_id, sv)
        if not ok_dot:
            conn.close()
            return fail(dot_err, 400)

        sv_he = normalize_sv_slot_he(sv)
        slot = conn.execute(
            "SELECT * FROM gv_slot WHERE gv_id = ? AND dot_id = ? AND he_dao_tao = ?",
            (gv_id, dot_id, sv_he),
        ).fetchone()
        if not slot:
            conn.close()
            return fail("Không có slot GV cho hệ (%s) của bạn trong đợt này" % sv_he, 400)
        if slot["duyet_tbm"] == 1 and slot["slot_con_lai"] <= 0:
            conn.close()
            return fail("GV đã hết slot hướng dẫn (%s) trong đợt này" % sv_he, 400)

        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO dang_ky (sv_id, gv_id, dot_id, loai, ten_de_tai, linh_vuc, trang_thai)
            VALUES (?, ?, ?, 'BCTT', ?, ?, 'cho_duyet')
            """,
            (sv["id"], gv_id, dot_id, ten, build_bctt_meta(linh_vuc, cong_ty, loai_de_tai)),
        )
        conn.commit()
        conn.close()
        return ok("Đăng ký BCTT thành công")

    @app.route("/api/kltn/register", methods=["POST"])
    @role_required("SV")
    def register_kltn():
        data = request.json or {}
        ten = (data.get("ten_de_tai") or "").strip()
        linh_vuc = (data.get("linh_vuc") or "").strip()
        loai_de_tai = (data.get("loai_de_tai") or "").strip()
        gv_id = data.get("gv_id")
        dot_id = data.get("dot_id")
        if not all([ten, linh_vuc, loai_de_tai, gv_id, dot_id]):
            return fail("Thiếu thông tin đăng ký KLTN", 400)
        if loai_de_tai not in ("ung_dung", "nghien_cuu"):
            return fail("Loại đề tài KLTN không hợp lệ", 400)

        conn = get_db()
        sv = get_current_user(conn)
        passed = conn.execute(
            "SELECT id FROM dang_ky WHERE sv_id = ? AND loai = 'BCTT' AND trang_thai = 'pass'",
            (sv["id"],),
        ).fetchone()
        if not passed:
            conn.close()
            return fail("Bạn chỉ được đăng ký KLTN khi BCTT = pass", 400)

        existed = conn.execute(
            "SELECT id FROM dang_ky WHERE sv_id = ? AND loai = 'KLTN'",
            (sv["id"],),
        ).fetchone()
        if existed:
            conn.close()
            return fail("Bạn đã đăng ký KLTN", 400)

        ok_dot, dot_err = dot_matches_student(conn, dot_id, sv)
        if not ok_dot:
            conn.close()
            return fail(dot_err, 400)

        gv = conn.execute(
            "SELECT id, role, linh_vuc FROM users WHERE id = ?",
            (gv_id,),
        ).fetchone()
        if not gv or gv["role"] not in ("GV", "TBM"):
            conn.close()
            return fail("Giảng viên hướng dẫn không hợp lệ", 400)
        # Bỏ ràng buộc: Giáo viên ngành khác vẫn có thể hướng dẫn được ngành khác

        conn.execute(
            """
            INSERT INTO dang_ky (sv_id, gv_id, dot_id, loai, ten_de_tai, linh_vuc, trang_thai)
            VALUES (?, ?, ?, 'KLTN', ?, ?, 'thuc_hien')
            """,
            (sv["id"], gv_id, dot_id, ten, build_kltn_meta(linh_vuc, loai_de_tai)),
        )
        conn.commit()
        conn.close()
        return ok("Đăng ký KLTN thành công")

    @app.route("/api/bctt/submit", methods=["POST"])
    @role_required("SV")
    def submit_bctt():
        data = request.json or {}
        dang_ky_id = data.get("dang_ky_id")
        if not dang_ky_id:
            return fail("Thiếu dang_ky_id", 400)
        conn = get_db()
        sv = get_current_user(conn)
        reg = conn.execute(
            "SELECT * FROM dang_ky WHERE id = ? AND sv_id = ? AND loai = 'BCTT'",
            (dang_ky_id, sv["id"]),
        ).fetchone()
        if not reg:
            conn.close()
            return fail("Không tìm thấy đăng ký BCTT", 404)
        if reg["trang_thai"] not in ("gv_xac_nhan", "cho_cham"):
            conn.close()
            return fail("BCTT chưa ở trạng thái được nộp hồ sơ", 400)
        files = conn.execute(
            "SELECT loai_file FROM nop_bai WHERE dang_ky_id = ? AND loai_file IN ('bctt_baocao','bctt_xacnhan')",
            (dang_ky_id,),
        ).fetchall()
        types = {f["loai_file"] for f in files}
        if "bctt_baocao" not in types or "bctt_xacnhan" not in types:
            conn.close()
            return fail("Cần nộp đủ báo cáo BCTT và giấy xác nhận", 400)
        conn.execute("UPDATE dang_ky SET trang_thai = 'cho_cham' WHERE id = ?", (dang_ky_id,))
        conn.commit()
        conn.close()
        return ok("Đã nộp hồ sơ BCTT, chờ GV chấm")

    @app.route("/api/bctt/grade", methods=["POST"])
    @role_required("GV", "TBM")
    def grade_bctt():
        data = request.json or {}
        dang_ky_id = data.get("dang_ky_id")
        diem = data.get("diem")
        nhan_xet = (data.get("nhan_xet") or "").strip()
        if diem is None:
            return fail("Thiếu điểm BCTT", 400)
        try:
            diem = float(diem)
        except ValueError:
            return fail("Điểm không hợp lệ", 400)
        if diem < 0 or diem > 10:
            return fail("Điểm phải từ 0 đến 10", 400)
        conn = get_db()
        gv = get_current_user(conn)
        role_hdr = str(request.headers.get("X-User-Role") or session.get("role") or "").upper()
        
        # TBM có thể chấm bất kỳ BCTT nào, GV chỉ chấm BCTT của mình
        if role_hdr == "TBM":
            reg = conn.execute(
                "SELECT * FROM dang_ky WHERE id = ? AND loai = 'BCTT'",
                (dang_ky_id,),
            ).fetchone()
        else:
            reg = conn.execute(
                "SELECT * FROM dang_ky WHERE id = ? AND gv_id = ? AND loai = 'BCTT'",
                (dang_ky_id, gv["id"]),
            ).fetchone()
        if not reg:
            conn.close()
            return fail("Không tìm thấy BCTT cần chấm", 404)
        if reg["trang_thai"] != "cho_cham":
            conn.close()
            return fail("BCTT chưa ở trạng thái chờ chấm", 400)
        # Bỏ yêu cầu Turnitin để cho phép GV chấm dù chưa có Turnitin
        # has_turnitin = conn.execute(
        #     "SELECT id FROM nop_bai WHERE dang_ky_id = ? AND loai_file = 'turnitin_bctt' LIMIT 1",
        #     (dang_ky_id,),
        # ).fetchone()
        # if not has_turnitin:
        #     conn.close()
        #     return fail("Cần upload file Turnitin BCTT trước khi chấm", 400)
        old = conn.execute(
            "SELECT id FROM cham_diem WHERE dang_ky_id = ? AND vai_tro = 'BCTT'",
            (dang_ky_id,),
        ).fetchone()
        if old:
            conn.execute(
                "UPDATE cham_diem SET diem = ?, nhan_xet = ? WHERE id = ?",
                (diem, nhan_xet, old["id"]),
            )
        else:
            conn.execute(
                """
                INSERT INTO cham_diem (dang_ky_id, gv_id, vai_tro, diem, nhan_xet, cau_hoi)
                VALUES (?, ?, 'BCTT', ?, ?, '')
                """,
                (dang_ky_id, gv["id"], diem, nhan_xet),
            )
        result = "pass" if diem >= 4 else "fail"
        conn.execute("UPDATE dang_ky SET trang_thai = ? WHERE id = ?", (result, dang_ky_id))
        conn.commit()
        conn.close()
        return ok("Chấm BCTT thành công")

    @app.route("/api/kltn/grade", methods=["POST"])
    @role_required("GV", "TBM")
    def grade_kltn():
        data = request.json or {}
        dang_ky_id = data.get("dang_ky_id")
        vai_tro = data.get("vai_tro")  # 'HD', 'PB', 'CT', etc.
        diem = data.get("diem")
        nhan_xet = (data.get("nhan_xet") or "").strip()
        cau_hoi = (data.get("cau_hoi") or "").strip()
        if not vai_tro:
            return fail("Thiếu vai_tro (HD/PB/CT)", 400)
        if diem is None:
            return fail("Thiếu điểm", 400)
        try:
            diem = float(diem)
        except ValueError:
            return fail("Điểm không hợp lệ", 400)
        if diem < 0 or diem > 10:
            return fail("Điểm phải từ 0 đến 10", 400)
        conn = get_db()
        gv = get_current_user(conn)
        role_hdr = str(request.headers.get("X-User-Role") or session.get("role") or "").upper()
        
        # Kiểm tra quyền chấm
        reg = conn.execute(
            "SELECT * FROM dang_ky WHERE id = ? AND loai = 'KLTN'",
            (dang_ky_id,),
        ).fetchone()
        if not reg:
            conn.close()
            return fail("Không tìm thấy KLTN cần chấm", 404)
        
        # Kiểm tra vai trò của GV
        can_score = False
        if vai_tro == 'HD' and reg["gv_id"] == gv["id"]:
            can_score = True
        elif vai_tro == 'PB':
            # PB info lưu trong bảng upload/phân công, tạm cho phép
            can_score = True
        elif vai_tro == 'CT':
            # CT info lưu trong bảng upload/phân công, tạm cho phép
            can_score = True
        elif role_hdr == "TBM":
            can_score = True  # TBM có thể chấm bất kỳ
        
        if not can_score:
            conn.close()
            return fail("Không có quyền chấm điểm vai trò này", 403)
        
        # Insert hoặc update cham_diem
        old = conn.execute(
            "SELECT id FROM cham_diem WHERE dang_ky_id = ? AND vai_tro = ?",
            (dang_ky_id, vai_tro),
        ).fetchone()
        if old:
            conn.execute(
                "UPDATE cham_diem SET diem = ?, nhan_xet = ?, cau_hoi = ? WHERE id = ?",
                (diem, nhan_xet, cau_hoi, old["id"]),
            )
        else:
            conn.execute(
                """
                INSERT INTO cham_diem (dang_ky_id, gv_id, vai_tro, diem, nhan_xet, cau_hoi)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (dang_ky_id, gv["id"], vai_tro, diem, nhan_xet, cau_hoi),
            )
        
        # Cập nhật trạng thái nếu tất cả 3 vai trò đã chấm
        cnt = conn.execute(
            "SELECT COUNT(DISTINCT vai_tro) AS c FROM cham_diem WHERE dang_ky_id = ? AND vai_tro IN ('HD','PB','CT') AND diem IS NOT NULL",
            (dang_ky_id,),
        ).fetchone()
        if cnt and cnt["c"] == 3:
            conn.execute("UPDATE dang_ky SET trang_thai = 'bao_ve' WHERE id = ?", (dang_ky_id,))
        
        conn.commit()
        conn.close()
        return ok("Chấm KLTN thành công")

    @app.route("/api/kltn/submit", methods=["POST"])
    @role_required("SV")
    def submit_kltn():
        data = request.json or {}
        dang_ky_id = data.get("dang_ky_id")
        if not dang_ky_id:
            return fail("Thiếu dang_ky_id", 400)
        conn = get_db()
        sv = get_current_user(conn)
        reg = conn.execute(
            "SELECT * FROM dang_ky WHERE id = ? AND sv_id = ? AND loai = 'KLTN'",
            (dang_ky_id, sv["id"]),
        ).fetchone()
        if not reg:
            conn.close()
            return fail("Không tìm thấy đăng ký KLTN", 404)
        if reg["trang_thai"] != "thuc_hien":
            conn.close()
            return fail("KLTN chưa ở trạng thái thực hiện", 400)
        files = conn.execute(
            """
            SELECT loai_file FROM nop_bai
            WHERE dang_ky_id = ? AND loai_file IN ('kltn_bai_pdf','kltn_bai_word')
            """,
            (dang_ky_id,),
        ).fetchall()
        types = {f["loai_file"] for f in files}
        if "kltn_bai_pdf" not in types or "kltn_bai_word" not in types:
            conn.close()
            return fail("Cần upload đủ file Word và PDF của bài KLTN trước khi nộp", 400)
        conn.execute("UPDATE dang_ky SET trang_thai = 'cham_diem' WHERE id = ?", (dang_ky_id,))
        conn.commit()
        conn.close()
        return ok("Đã nộp KLTN, chờ chấm điểm")

    @app.route("/api/kltn/revision-approve", methods=["POST"])
    @role_required("GV")
    def approve_kltn_revision():
        data = request.json or {}
        dang_ky_id = data.get("dang_ky_id")
        step = data.get("step")
        dong_y = data.get("dong_y", True)
        if step not in ("gvhd", "cthd"):
            return fail("Step không hợp lệ", 400)
        conn = get_db()
        gv = get_current_user(conn)
        reg = conn.execute("SELECT * FROM dang_ky WHERE id = ? AND loai = 'KLTN'", (dang_ky_id,)).fetchone()
        if not reg:
            conn.close()
            return fail("Không tìm thấy KLTN", 404)
        uploads = conn.execute(
            "SELECT loai_file FROM nop_bai WHERE dang_ky_id = ? AND loai_file IN ('kltn_chinhsua','bien_ban_giai_trinh')",
            (dang_ky_id,),
        ).fetchall()
        up_types = {u["loai_file"] for u in uploads}
        if "kltn_chinhsua" not in up_types or "bien_ban_giai_trinh" not in up_types:
            conn.close()
            return fail("SV chưa nộp đủ bài chỉnh sửa và biên bản giải trình", 400)
        if step == "gvhd":
            if gv["id"] != reg["gv_id"]:
                conn.close()
                return fail("Chỉ GVHD mới được duyệt bước này", 403)
            conn.execute(
                "DELETE FROM nop_bai WHERE dang_ky_id = ? AND loai_file IN ('xac_nhan_gvhd','xac_nhan_cthd')",
                (dang_ky_id,),
            )
            if not dong_y:
                conn.execute(
                    "DELETE FROM nop_bai WHERE dang_ky_id = ? AND loai_file IN ('kltn_chinhsua','bien_ban_giai_trinh','xac_nhan_gvhd','xac_nhan_cthd')",
                    (dang_ky_id,),
                )
                ly_do = data.get("ly_do", "").strip()
                conn.execute(
                    "INSERT INTO nop_bai (dang_ky_id, loai_file, file_path) VALUES (?, 'tu_choi_gvhd', ?)",
                    (dang_ky_id, ly_do),
                )

                conn.execute(
                    """
                    INSERT INTO thong_bao (nguoi_nhan_id, nguoi_gui_id, dang_ky_id, loai, noi_dung)
                    VALUES (?, ?, ?, 'tu_choi_gvhd', ?)
                    """,
                    (
                        reg["sv_id"],
                        gv["id"],
                        dang_ky_id,
                        ly_do if ly_do else "GVHD yêu cầu bạn chỉnh sửa và nộp lại bài KLTN",
                    ),
                )
                conn.commit()
                conn.close()
                return ok("GVHD đã từ chối; sinh viên cần chỉnh sửa và nộp lại")
            conn.execute(
                "INSERT INTO nop_bai (dang_ky_id, loai_file, file_path) VALUES (?, 'xac_nhan_gvhd', ?)",
                (dang_ky_id, str(gv["id"])),
            )
        else:
            hd = _hoi_dong_ids(conn, dang_ky_id)
            if not hd or hd["ct"] != gv["id"]:
                conn.close()
                return fail("Chỉ Chủ tịch hội đồng mới được duyệt bước này", 403)
            has_gvhd = conn.execute(
                "SELECT id FROM nop_bai WHERE dang_ky_id = ? AND loai_file = 'xac_nhan_gvhd' LIMIT 1",
                (dang_ky_id,),
            ).fetchone()
            if not has_gvhd:
                conn.close()
                return fail("GVHD chưa duyệt chỉnh sửa — Chủ tịch HĐ chưa được thao tác", 400)
            conn.execute(
                "DELETE FROM nop_bai WHERE dang_ky_id = ? AND loai_file = 'xac_nhan_cthd'",
                (dang_ky_id,),
            )
            if not dong_y:
                conn.execute(
                    "DELETE FROM nop_bai WHERE dang_ky_id = ? AND loai_file IN ('kltn_chinhsua','bien_ban_giai_trinh','xac_nhan_gvhd','xac_nhan_cthd')",
                    (dang_ky_id,),
                )
                ly_do = data.get("ly_do", "").strip()
                conn.execute(
                    "INSERT INTO nop_bai (dang_ky_id, loai_file, file_path) VALUES (?, 'tu_choi_cthd', ?)",
                    (dang_ky_id, ly_do),
                )

                conn.execute(
                    """
                    INSERT INTO thong_bao (nguoi_nhan_id, nguoi_gui_id, dang_ky_id, loai, noi_dung)
                    VALUES (?, ?, ?, 'tu_choi_cthd', ?)
                    """,
                    (
                        reg["sv_id"],
                        gv["id"],
                        dang_ky_id,
                        ly_do if ly_do else "Chủ tịch HĐ yêu cầu bạn chỉnh sửa và nộp lại bài KLTN",
                    ),
                )
                conn.commit()
                conn.close()
                return ok("Chủ tịch HĐ đã từ chối; sinh viên cần chỉnh sửa và nộp lại")
            conn.execute(
                "INSERT INTO nop_bai (dang_ky_id, loai_file, file_path) VALUES (?, 'xac_nhan_cthd', ?)",
                (dang_ky_id, str(gv["id"])),
            )
            conn.execute("UPDATE dang_ky SET trang_thai = 'hoan_thanh' WHERE id = ?", (dang_ky_id,))
        conn.commit()
        conn.close()
        return ok("Duyệt chỉnh sửa thành công")

    @app.route("/api/kltn/bien-ban-tk", methods=["POST"])
    @role_required("GV")
    def save_bien_ban_tk():
        data = request.json or {}
        dang_ky_id = data.get("dang_ky_id")
        noi_dung = data.get("noi_dung")
        if noi_dung is None:
            noi_dung = ""
        else:
            noi_dung = str(noi_dung)
        if not dang_ky_id:
            return fail("Thiếu dang_ky_id", 400)
        conn = get_db()
        gv = get_current_user(conn)
        hd = _hoi_dong_ids(conn, dang_ky_id)
        if not hd or hd["tk"] != gv["id"]:
            conn.close()
            return fail("Chỉ Thư ký hội đồng được lưu biên bản này", 403)
        conn.execute("DELETE FROM nop_bai WHERE dang_ky_id = ? AND loai_file = 'bien_ban_tk'", (dang_ky_id,))
        conn.execute(
            "INSERT INTO nop_bai (dang_ky_id, loai_file, file_path) VALUES (?, 'bien_ban_tk', ?)",
            (dang_ky_id, noi_dung),
        )
        conn.commit()
        conn.close()
        return ok("Đã lưu nội dung biên bản (Thư ký)")

    @app.route("/api/bctt/approve", methods=["POST"])
    @role_required("GV", "TBM")
    def approve_bctt():
        data = request.json or {}
        ids = data.get("dang_ky_ids") or []
        action = data.get("action")

        if action not in ("dong_y", "tu_choi"):
            return fail("Action không hợp lệ", 400)
        if not ids:
            return fail("Danh sách đăng ký trống", 400)

        conn = get_db()
        gv = get_current_user(conn)
        cursor = conn.cursor()

        if action == "tu_choi":
            placeholders = ",".join(["?"] * len(ids))
            if gv["role"] == "TBM":
                cursor.execute(
                    f"""
                    UPDATE dang_ky SET trang_thai = 'tu_choi'
                    WHERE id IN ({placeholders}) AND loai = 'BCTT'
                    """,
                    [*ids],
                )
            else:
                cursor.execute(
                    f"""
                    UPDATE dang_ky SET trang_thai = 'tu_choi'
                    WHERE id IN ({placeholders}) AND gv_id = ? AND loai = 'BCTT'
                    """,
                    [*ids, gv["id"]],
                )
            success_count = cursor.rowcount

        else:
            success_count = 0
            for dk_id in ids:
                if gv["role"] == "TBM":
                    dk = cursor.execute(
                        """
                        SELECT dk.dot_id, dk.trang_thai, sv.he_dao_tao, dk.gv_id
                        FROM dang_ky dk
                        JOIN users sv ON sv.id = dk.sv_id
                        WHERE dk.id = ? AND dk.loai = 'BCTT'
                        """,
                        (dk_id,),
                    ).fetchone()
                else:
                    dk = cursor.execute(
                        """
                        SELECT dk.dot_id, dk.trang_thai, sv.he_dao_tao
                        FROM dang_ky dk
                        JOIN users sv ON sv.id = dk.sv_id
                        WHERE dk.id = ? AND dk.gv_id = ? AND dk.loai = 'BCTT'
                        """,
                        (dk_id, gv["id"]),
                    ).fetchone()

                if not dk or dk["trang_thai"] != "cho_duyet":
                    continue

                sv_he = normalize_sv_slot_he(dk)
                if gv["role"] == "TBM":
                    # Cho bm, không giảm slot, chỉ update trạng thái
                    cursor.execute("UPDATE dang_ky SET trang_thai = 'gv_xac_nhan' WHERE id = ?", (dk_id,))
                    success_count += 1
                else:
                    slot = cursor.execute(
                        "SELECT id, slot_con_lai FROM gv_slot WHERE gv_id = ? AND dot_id = ? AND he_dao_tao = ?",
                        (gv["id"], dk["dot_id"], sv_he),
                    ).fetchone()

                    if slot and slot["slot_con_lai"] > 0:
                        cursor.execute("UPDATE dang_ky SET trang_thai = 'gv_xac_nhan' WHERE id = ?", (dk_id,))
                        cursor.execute("UPDATE gv_slot SET slot_con_lai = slot_con_lai - 1 WHERE id = ?", (slot["id"],))
                        success_count += 1

        conn.commit()
        conn.close()

        if action == "dong_y" and success_count == 0 and len(ids) > 0:
            return fail("Không thể duyệt! Quota hướng dẫn của bạn đã hết.", 400)

        return ok(f"Đã xử lý thành công {success_count} đề tài BCTT.")

    @app.route("/api/bctt/rename", methods=["POST"])
    @role_required("GV")
    def rename_bctt():
        data = request.json or {}
        dang_ky_id = data.get("dang_ky_id")
        new_name = (data.get("ten_de_tai") or "").strip()
        if not dang_ky_id or not new_name:
            return fail("Thiếu dữ liệu đổi tên đề tài", 400)

        conn = get_db()
        gv = get_current_user(conn)
        reg = conn.execute(
            "SELECT * FROM dang_ky WHERE id = ? AND gv_id = ? AND loai = 'BCTT'",
            (dang_ky_id, gv["id"]),
        ).fetchone()
        if not reg:
            conn.close()
            return fail("Không tìm thấy đề tài BCTT cần đổi tên", 404)

        conn.execute(
            "UPDATE dang_ky SET ten_de_tai = ?, trang_thai = 'gv_xac_nhan' WHERE id = ?",
            (new_name, dang_ky_id),
        )
        conn.commit()
        conn.close()
        return ok("Đã đổi tên và xác nhận đề tài BCTT")

    @app.route("/api/gv-slot/duyet", methods=["POST"])
    @role_required("TBM")
    def duyet_slot():
        data = request.json or {}
        slot_id = data.get("slot_id")
        gv_id = data.get("gv_id")
        dot_id = data.get("dot_id")
        duyet = 1 if data.get("duyet", True) else 0
        conn = get_db()
        current_user = get_current_user(conn)
        if not current_user:
            conn.close()
            return fail("Chưa đăng nhập", 401)

        target_gv_id = None
        if slot_id:
            slot = conn.execute("SELECT gv_id FROM gv_slot WHERE id = ?", (slot_id,)).fetchone()
            if not slot:
                conn.close()
                return fail("Không tìm thấy slot", 404)
            target_gv_id = slot["gv_id"]
        elif gv_id:
            target_gv_id = gv_id

        if target_gv_id is not None:
            target_gv = conn.execute("SELECT id, ho_ten, linh_vuc FROM users WHERE id = ?", (target_gv_id,)).fetchone()
            if not target_gv:
                conn.close()
                return fail("Không tìm thấy giảng viên", 404)
            if not user_has_common_major(current_user, target_gv):
                conn.close()
                return fail("Chỉ trưởng bộ môn cùng ngành mới được khóa/mở slot", 403)

        cursor = conn.cursor()
        if slot_id:
            cursor.execute("UPDATE gv_slot SET duyet_tbm = ? WHERE id = ?", (duyet, slot_id))
        elif gv_id and dot_id:
            cursor.execute(
                "UPDATE gv_slot SET duyet_tbm = ? WHERE gv_id = ? AND dot_id = ?",
                (duyet, gv_id, dot_id),
            )
        else:
            conn.close()
            return fail("Thiếu slot_id hoặc (gv_id, dot_id)", 400)

        if cursor.rowcount == 0:
            conn.close()
            return fail("Không tìm thấy slot BCTT phù hợp để cập nhật", 404)

        conn.commit()
        conn.close()
        return ok("Cập nhật trạng thái slot thành công")


    @app.route("/api/gv-slot/update", methods=["POST"])
    @role_required("TBM")
    def update_gv_slot():
        data = request.json or {}
        slot_id = data.get("slot_id")
        gv_id = data.get("gv_id")
        he_dao_tao = (data.get("he_dao_tao") or "").strip()
        quota = data.get("quota")
        slot_con_lai = data.get("slot_con_lai")
        if not slot_id and not (gv_id and he_dao_tao):
            return fail("Thiếu slot_id hoặc (gv_id, he_dao_tao)", 400)
        if quota is None and slot_con_lai is None:
            return fail("Thiếu dữ liệu cập nhật slot", 400)

        conn = get_db()
        current_user = get_current_user(conn)
        if not current_user:
            conn.close()
            return fail("Chưa đăng nhập", 401)

        slot = None
        target_gv_id = None
        if slot_id:
            slot = conn.execute(
                "SELECT id, gv_id, quota, slot_con_lai, he_dao_tao FROM gv_slot WHERE id = ?",
                (slot_id,),
            ).fetchone()
            if not slot:
                conn.close()
                return fail("Không tìm thấy slot", 404)
            target_gv_id = slot["gv_id"]
            if not he_dao_tao:
                he_dao_tao = (slot["he_dao_tao"] or "").strip() or "DaiTra"
        else:
            target_gv_id = gv_id
            slot = conn.execute(
                """
                SELECT id, gv_id, quota, slot_con_lai, he_dao_tao
                FROM gv_slot
                WHERE gv_id = ? AND he_dao_tao = ?
                ORDER BY id ASC
                LIMIT 1
                """,
                (gv_id, he_dao_tao),
            ).fetchone()
            if not slot:
                conn.close()
                return fail("Không tìm thấy slot theo hệ đào tạo", 404)

        target_gv = conn.execute(
            "SELECT id, ho_ten, linh_vuc FROM users WHERE id = ?",
            (target_gv_id,),
        ).fetchone()
        if not target_gv:
            conn.close()
            return fail("Không tìm thấy giảng viên", 404)
        if not user_has_common_major(current_user, target_gv):
            conn.close()
            return fail("Chỉ trưởng bộ môn cùng ngành mới được sửa slot", 403)

        new_quota = slot["quota"]
        new_slot_con_lai = slot["slot_con_lai"]
        try:
            if quota is not None:
                new_quota = int(quota)
            if slot_con_lai is not None:
                new_slot_con_lai = int(slot_con_lai)
        except (TypeError, ValueError):
            conn.close()
            return fail("Quota hoặc slot còn lại không hợp lệ", 400)

        if new_quota < 0 or new_slot_con_lai < 0:
            conn.close()
            return fail("Quota và slot còn lại phải >= 0", 400)
        if new_slot_con_lai > new_quota:
            conn.close()
            return fail("Slot còn lại không được lớn hơn quota", 400)

        if he_dao_tao:
            cursor = conn.execute(
                """
                UPDATE gv_slot
                SET quota = ?, slot_con_lai = ?
                WHERE gv_id = ? AND he_dao_tao = ?
                """,
                (new_quota, new_slot_con_lai, target_gv_id, he_dao_tao),
            )
            if cursor.rowcount == 0:
                conn.close()
                return fail("Không tìm thấy slot theo hệ đào tạo để cập nhật", 404)
        else:
            conn.execute(
                "UPDATE gv_slot SET quota = ?, slot_con_lai = ? WHERE id = ?",
                (new_quota, new_slot_con_lai, slot_id),
            )
        conn.commit()
        conn.close()
        return ok("Cập nhật slot giảng viên thành công")

    @app.route("/api/phan-cong", methods=["POST"])
    @role_required("TBM")
    def assign_roles():
        data = request.json or {}
        dang_ky_id = data.get("dang_ky_id")
        gv_hd_id = data.get("gv_hd_id")
        gv_pb_id = data.get("gv_pb_id")

        if not dang_ky_id:
            return fail("Thiếu ID đăng ký", 400)

        conn = get_db()
        reg = conn.execute(
            "SELECT id, loai, linh_vuc, gv_id FROM dang_ky WHERE id = ?",
            (dang_ky_id,),
        ).fetchone()
        if not reg:
            conn.close()
            return fail("Không tìm thấy đăng ký", 404)

        major = kltn_major_from_dang_ky(reg["linh_vuc"])
        if major:
            check_ids = []
            if gv_hd_id is not None:
                check_ids.append(int(gv_hd_id))
            elif reg["gv_id"] is not None:
                check_ids.append(reg["gv_id"])
            if gv_pb_id is not None:
                check_ids.append(int(gv_pb_id))
            if check_ids:
                ok_m, err_m = assert_kltn_assignees_match_major(conn, major, check_ids)
                if not ok_m:
                    conn.close()
                    return fail(err_m, 400)

        if gv_hd_id is not None:
            conn.execute("UPDATE dang_ky SET gv_id = ? WHERE id = ?", (gv_hd_id, dang_ky_id))

        if gv_pb_id is not None:
            if reg["loai"] != "KLTN":
                conn.close()
                return fail("Chỉ phân công phản biện cho KLTN", 400)

            conn.execute("DELETE FROM nop_bai WHERE dang_ky_id = ? AND loai_file = 'phanbien_gv'", (dang_ky_id,))
            conn.execute(
                "INSERT INTO nop_bai (dang_ky_id, loai_file, file_path) VALUES (?, 'phanbien_gv', ?)",
                (dang_ky_id, str(gv_pb_id)),
            )

        conn.commit()
        conn.close()
        return ok("Phân công thành công")

    @app.route("/api/kltn/pb-accept", methods=["POST"])
    @role_required("GV")
    def pb_accept():
        data = request.json or {}
        dang_ky_id = data.get("dang_ky_id")
        conn = get_db()
        gv = get_current_user(conn)
        assigned = conn.execute(
            "SELECT id FROM nop_bai WHERE dang_ky_id = ? AND loai_file = 'phanbien_gv' AND file_path = ? LIMIT 1",
            (dang_ky_id, str(gv["id"])),
        ).fetchone()
        if not assigned:
            conn.close()
            return fail("Bạn chưa được phân công phản biện đề tài này", 403)

        conn.execute("UPDATE dang_ky SET trang_thai = 'cham_diem' WHERE id = ?", (dang_ky_id,))

        conn.execute(
            "INSERT INTO nop_bai (dang_ky_id, loai_file, file_path) VALUES (?, 'pb_accepted', ?)",
            (dang_ky_id, str(gv["id"])),
        )
        conn.commit()
        conn.close()
        return ok("Đã xác nhận phản biện KLTN, bạn có thể bắt đầu chấm điểm.")

    @app.route("/api/phan-cong/hoi-dong", methods=["POST"])
    @role_required("TBM")
    def assign_council():
        data = request.json or {}
        dang_ky_id = data.get("dang_ky_id")
        ct_id = data.get("ct_id")
        tk_id = data.get("tk_id")
        tv_ids = data.get("tv_ids")
        single_tv = data.get("tv_id")
        if tv_ids is None:
            tv_ids = [single_tv] if single_tv else []
        if not all([dang_ky_id, ct_id, tk_id]) or not tv_ids:
            return fail("Thiếu thông tin hội đồng (cần CT, TK và ít nhất 1 TV)", 400)

        conn = get_db()
        reg_hd = conn.execute(
            "SELECT loai, linh_vuc FROM dang_ky WHERE id = ?",
            (dang_ky_id,),
        ).fetchone()
        if not reg_hd or reg_hd["loai"] != "KLTN":
            conn.close()
            return fail("Chỉ lập hội đồng cho đăng ký KLTN", 400)
        major = kltn_major_from_dang_ky(reg_hd["linh_vuc"])
        council_ids = [ct_id, tk_id, *tv_ids]
        # Bỏ ràng buộc: Cho phép giáo viên ngành khác lập hội đồng hướng dẫn
        # ok_m, err_m = assert_kltn_assignees_match_major(conn, major, council_ids)
        # if not ok_m:
        #     conn.close()
        #     return fail(err_m, 400)

        all_member_ids = [str(ct_id), str(tk_id), *[str(tv_id) for tv_id in tv_ids]]
        hoi_dong_path = "|".join(all_member_ids)

        conn.execute(
            "DELETE FROM nop_bai WHERE dang_ky_id = ? AND loai_file = 'hoi_dong'",
            (dang_ky_id,),
        )
        conn.execute(
            "INSERT INTO nop_bai (dang_ky_id, loai_file, file_path) VALUES (?, 'hoi_dong', ?)",
            (dang_ky_id, hoi_dong_path),
        )

        conn.commit()
        conn.close()
        return ok("Lập hội đồng thành công")

    @app.route("/api/cham-diem", methods=["POST"])
    @role_required("GV", "TBM")
    def score():
        data = request.json or {}
        dang_ky_id = data.get("dang_ky_id")
        vai_tro = str(data.get("vai_tro") or "").upper()
        diem = data.get("diem")
        nhan_xet = data.get("nhan_xet", "")
        cau_hoi = data.get("cau_hoi", "")
        criteria_json = data.get("criteria_json", "")
        if not all([dang_ky_id, vai_tro]) or diem is None:
            return fail("Thiếu dữ liệu chấm điểm", 400)
        if vai_tro not in ("HD", "PB", "TV"):
            return fail("Vai trò chấm điểm không hợp lệ", 400)
        try:
            diem = float(diem)
        except ValueError:
            return fail("Điểm không hợp lệ", 400)
        if diem < 0 or diem > 10:
            return fail("Điểm phải từ 0 đến 10", 400)

        conn = get_db()
        gv = get_current_user(conn)
        reg_chk = conn.execute("SELECT loai FROM dang_ky WHERE id = ?", (dang_ky_id,)).fetchone()
        if reg_chk and reg_chk["loai"] == "KLTN":
            if not _can_score_kltn(conn, dang_ky_id, gv["id"], vai_tro):
                conn.close()
                return fail("Bạn không được phân công chấm điểm với vai trò này", 403)
        old = conn.execute(
            "SELECT id FROM cham_diem WHERE dang_ky_id = ? AND gv_id = ? AND vai_tro = ?",
            (dang_ky_id, gv["id"], vai_tro),
        ).fetchone()
        if old:
            conn.execute(
                """
                UPDATE cham_diem
                SET diem = ?, nhan_xet = ?, cau_hoi = ?, criteria_json = ?
                WHERE id = ?
                """,
                (diem, nhan_xet, cau_hoi, criteria_json, old["id"]),
            )
        else:
            conn.execute(
                """
                INSERT INTO cham_diem (dang_ky_id, gv_id, vai_tro, diem, nhan_xet, cau_hoi, criteria_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (dang_ky_id, gv["id"], vai_tro, diem, nhan_xet, cau_hoi, criteria_json),
            )
        reg = conn.execute("SELECT loai FROM dang_ky WHERE id = ?", (dang_ky_id,)).fetchone()
        if reg and reg["loai"] == "KLTN":
            if vai_tro == "PB":
                if not str(nhan_xet or "").strip() or not str(cau_hoi or "").strip():
                    conn.close()
                    return fail("GV phản biện: bắt buộc nhập nhận xét và câu hỏi (Thư ký đưa vào biên bản)", 400)
            required = conn.execute(
                """
                SELECT
                    SUM(CASE WHEN vai_tro = 'HD' AND diem IS NOT NULL THEN 1 ELSE 0 END) AS has_hd,
                    SUM(CASE WHEN vai_tro = 'PB' AND diem IS NOT NULL THEN 1 ELSE 0 END) AS has_pb,
                    SUM(CASE WHEN vai_tro = 'TV' AND diem IS NOT NULL THEN 1 ELSE 0 END) AS tv_count
                FROM cham_diem
                WHERE dang_ky_id = ?
                """,
                (dang_ky_id,),
            ).fetchone()
            if required and required["has_hd"] and required["has_pb"] and required["tv_count"]:
                conn.execute("UPDATE dang_ky SET trang_thai = 'bao_ve' WHERE id = ?", (dang_ky_id,))
        conn.commit()
        conn.close()
        return ok("Lưu điểm thành công")

    @app.route("/api/cham-diem/xuat-docx", methods=["POST"])
    @login_required
    def xuat_cham_diem_docx():
        data = request.json or {}
        tmp = tempfile.NamedTemporaryFile(suffix=".docx", delete=False)
        tmp.close()
        out_path = tmp.name
        script_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "scripts", "node", "gen_cham_diem.js"
        )
        script_path = os.path.abspath(script_path)
        try:
            result = subprocess.run(
                ["node", script_path, _json_mod.dumps(data, ensure_ascii=False), out_path],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode != 0 or not os.path.exists(out_path):
                return fail(f"Lỗi tạo file: {result.stderr or result.stdout}", 500)
            ma_sv = data.get("maSV", "SV")
            ten = str(data.get("tenDeTai", "ChamDiem"))[:30].replace(" ", "_")

            @after_this_request
            def cleanup(response):
                try:
                    os.unlink(out_path)
                except Exception:
                    pass
                return response

            return send_file_response(
                out_path,
                f"ChamDiem_{ma_sv}_{ten}.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        except subprocess.TimeoutExpired:
            return fail("Timeout", 500)
        except Exception as e:
            return fail(str(e), 500)

    @app.route("/api/kltn/finalize", methods=["POST"])
    @role_required("TBM", "GV")
    def finalize_kltn():
        data = request.json or {}
        dang_ky_id = data.get("dang_ky_id")
        if not dang_ky_id:
            return fail("Thiếu dang_ky_id", 400)
        conn = get_db()
        gv = get_current_user(conn)
        role_hdr = str(request.headers.get("X-User-Role") or session.get("role") or "").upper()
        ct_id = _hoi_dong_ids(conn, dang_ky_id)
        ct_id = ct_id["ct"] if ct_id else None
        if role_hdr == "TBM":
            pass
        elif role_hdr == "GV" and ct_id is not None and gv["id"] == ct_id:
            pass
        else:
            conn.close()
            return fail("Chỉ Chủ tịch hội đồng hoặc TBM được kết thúc (pass/fail) KLTN", 403)
        rows = conn.execute(
            "SELECT vai_tro, diem FROM cham_diem WHERE dang_ky_id = ?",
            (dang_ky_id,),
        ).fetchall()

        diem_hd = next((r["diem"] for r in rows if r["vai_tro"] == "HD"), None)
        diem_pb = next((r["diem"] for r in rows if r["vai_tro"] == "PB"), None)

        diem_tv_list = [r["diem"] for r in rows if r["vai_tro"] == "TV"]
        diem_ct = next((r["diem"] for r in rows if r["vai_tro"] == "CT"), None)

        hoi_dong_scores = diem_tv_list
        if diem_ct is not None:
            hoi_dong_scores.append(diem_ct)

        if diem_hd is None or diem_pb is None or not hoi_dong_scores:
            conn.close()
            return fail("Chưa đủ điểm HD/PB/HĐ để kết thúc KLTN", 400)

        avg_hd = sum(hoi_dong_scores) / len(hoi_dong_scores)
        final_avg = (diem_hd * 0.2) + (diem_pb * 0.2) + (avg_hd * 0.6)

        result = "pass" if final_avg >= 4 else "fail"
        conn.execute("UPDATE dang_ky SET trang_thai = ? WHERE id = ? AND loai = 'KLTN'", (result, dang_ky_id))
        conn.commit()
        conn.close()
        return ok("Kết thúc KLTN thành công", {"average": round(final_avg, 2), "result": result})

    @app.route("/api/dot-list", methods=["GET"])
    @role_required("TBM")
    def get_dot_list():
        conn = get_db()
        gv = get_current_user(conn)
        if not gv:
            conn.close()
            return fail("Không tìm thấy người dùng", 401)

        nganh_list = [x.strip() for x in (gv["linh_vuc"] or "").split(",") if x.strip()]
        if not nganh_list:
            conn.close()
            return ok("Lấy danh sách đợt", {"dotList": []})

        dots = conn.execute(
            "SELECT id, ten_dot, loai, han_dang_ky, han_nop, trang_thai, nganh FROM dot WHERE nganh IN ({})".format(
                ",".join(["?"] * len(nganh_list))
            ),
            nganh_list,
        ).fetchall()

        dot_list = [dict(row) for row in dots]
        conn.close()
        return ok("Lấy danh sách đợt", {"dotList": dot_list})

    @app.route("/api/dot/update-status", methods=["POST"])
    @role_required("TBM")
    def update_dot_status():
        data = request.json or {}
        dot_id = data.get("dot_id")
        trang_thai = data.get("trang_thai")

        if not dot_id or trang_thai not in ["mo", "dong"]:
            return fail("Thiếu dot_id hoặc trang_thai không hợp lệ", 400)

        conn = get_db()
        gv = get_current_user(conn)
        if not gv:
            conn.close()
            return fail("Không tìm thấy người dùng", 401)

        try:
            dot_id = int(dot_id)
        except (TypeError, ValueError):
            conn.close()
            return fail("dot_id không hợp lệ", 400)

        dot = conn.execute("SELECT id, nganh FROM dot WHERE id = ?", (dot_id,)).fetchone()
        if not dot:
            conn.close()
            return fail("Không tìm thấy đợt", 404)

        nganh_list = [x.strip() for x in (gv["linh_vuc"] or "").split(",") if x.strip()]
        dot_nganh = (dot["nganh"] or "").strip()

        if dot_nganh not in nganh_list:
            conn.close()
            return fail("Bạn không được phép quản lý đợt này (ngoài lĩnh vực quản lý)", 403)

        conn.execute("UPDATE dot SET trang_thai = ? WHERE id = ?", (trang_thai, dot_id))
        conn.commit()
        conn.close()

        status_text = "Mở" if trang_thai == "mo" else "Khóa"
        return ok(f"{status_text} đợt thành công")

    @app.route("/api/upload", methods=["POST"])
    @login_required
    def upload():
        dang_ky_id = request.form.get("dang_ky_id")
        loai = request.form.get("loai_file")
        ma_sv = request.form.get("ma_sv")
        if not all([dang_ky_id, loai, ma_sv]):
            return fail("Thiếu dữ liệu upload", 400)
        if "file" not in request.files:
            return fail("Không có file upload", 400)

        f = request.files["file"]
        if not f.filename:
            return fail("Tên file rỗng", 400)
        if not f.filename.lower().endswith((".pdf", ".doc", ".docx")):
            return fail("Chỉ chấp nhận file PDF, DOC, hoặc DOCX", 400)

        safe_name = secure_filename(f.filename)
        target_dir = os.path.join(UPLOAD_FOLDER, loai, ma_sv)
        os.makedirs(target_dir, exist_ok=True)
        save_path = os.path.join(target_dir, f"{int(datetime.now().timestamp())}_{safe_name}")
        f.save(save_path)

        conn = get_db()
        conn.execute(
            "INSERT INTO nop_bai (dang_ky_id, loai_file, file_path) VALUES (?, ?, ?)",
            (dang_ky_id, loai, save_path.replace("\\", "/")),
        )
        conn.commit()
        conn.close()
        return ok("Upload file thành công", {"file_path": save_path.replace("\\", "/")})

    @app.route("/api/thong-ke", methods=["GET"])
    @role_required("TBM")
    def thong_ke():
        conn = get_db()
        rows = conn.execute(
            """
            SELECT d.ten_dot, COUNT(dk.id) AS tong,
                   SUM(CASE WHEN dk.trang_thai = 'pass' THEN 1 ELSE 0 END) AS pass_count
            FROM dang_ky dk
            JOIN dot d ON d.id = dk.dot_id
            WHERE dk.loai = 'KLTN'
            GROUP BY d.id
            ORDER BY d.id ASC
            """
        ).fetchall()
        conn.close()
        data = [{"ten_dot": r["ten_dot"], "tong": r["tong"], "pass": r["pass_count"] or 0} for r in rows]
        return ok("Thống kê thành công", {"rows": data})

    @app.route("/api/bien-ban/luu", methods=["POST"])
    @login_required
    def luu_bien_ban():
        data = request.json or {}
        ma_sv = data.get("maSV", "unknown")
        dang_ky_id = data.get("dangKyId")
        file_b64 = data.get("fileBase64")
        filename = data.get("filename", "bien_ban.docx")
        if not file_b64 or not dang_ky_id:
            return fail("Thiếu dữ liệu", 400)
        target_dir = os.path.join("uploads", "bien_ban_tk", str(ma_sv))
        os.makedirs(target_dir, exist_ok=True)
        save_path = os.path.join(target_dir, f"{int(datetime.now().timestamp())}_{secure_filename(filename)}")
        with open(save_path, "wb") as f:
            f.write(base64.b64decode(file_b64))
        conn = get_db()
        conn.execute("DELETE FROM nop_bai WHERE dang_ky_id = ? AND loai_file = 'bien_ban_tk'", (dang_ky_id,))
        conn.execute(
            "INSERT INTO nop_bai (dang_ky_id, loai_file, file_path) VALUES (?, 'bien_ban_tk', ?)",
            (dang_ky_id, save_path.replace("\\", "/")),
        )
        conn.commit()
        conn.close()
        return ok("Lưu biên bản thành công", {"file_path": save_path.replace("\\", "/")})

    @app.route("/uploads/<path:filename>")
    def download_file(filename):
        directory = os.path.join(app.root_path, "uploads", os.path.dirname(filename))
        file = os.path.basename(filename)
        return send_from_directory(directory, file, as_attachment=True)

    @app.route("/api/bien-ban/xuat-docx", methods=["POST"])
    @login_required
    def xuat_bien_ban_docx():
        data = request.json or {}
        tmp = tempfile.NamedTemporaryFile(suffix=".docx", delete=False)
        tmp.close()
        out_path = tmp.name
        script_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "scripts", "node", "gen_bien_ban.js"
        )
        script_path = os.path.abspath(script_path)
        try:
            result = subprocess.run(
                ["node", script_path, _json_mod.dumps(data, ensure_ascii=False), out_path],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode != 0 or not os.path.exists(out_path):
                return fail(f"Lỗi tạo file: {result.stderr or result.stdout}", 500)
            ma_sv = data.get("maSV", "SV")
            ten = data.get("tenDeTai", "bien_ban")[:30].replace(" ", "_")

            @after_this_request
            def cleanup(response):
                try:
                    os.unlink(out_path)
                except Exception:
                    pass
                return response

            return send_file_response(
                out_path,
                f"BienBan_{ma_sv}_{ten}.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        except subprocess.TimeoutExpired:
            return fail("Timeout", 500)
        except Exception as e:
            return fail(str(e), 500)

    @app.route("/api/thong-bao", methods=["GET"])
    @login_required
    def get_thong_bao():
        conn = get_db()
        user = get_current_user(conn)
        rows = conn.execute(
            """
            SELECT tb.*, u.ho_ten AS ten_nguoi_gui
            FROM thong_bao tb
            LEFT JOIN users u ON u.id = tb.nguoi_gui_id
            WHERE tb.nguoi_nhan_id = ?
            ORDER BY tb.tao_luc DESC
            """,
            (user["id"],),
        ).fetchall()
        conn.close()
        data = [dict(r) for r in rows]
        return ok("Lấy thông báo thành công", {"thong_bao": data})

    @app.route("/api/thong-bao/doc", methods=["POST"])
    @login_required
    def mark_read():
        data = request.json or {}
        tb_id = data.get("id")
        conn = get_db()
        user = get_current_user(conn)
        if tb_id:
            conn.execute(
                "UPDATE thong_bao SET da_doc = 1 WHERE id = ? AND nguoi_nhan_id = ?",
                (tb_id, user["id"]),
            )
        else:
            conn.execute(
                "UPDATE thong_bao SET da_doc = 1 WHERE nguoi_nhan_id = ?",
                (user["id"],),
            )
        conn.commit()
        conn.close()
        return ok("Đã cập nhật trạng thái đọc")
