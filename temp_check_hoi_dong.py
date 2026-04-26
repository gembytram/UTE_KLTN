import sqlite3
import json
conn = sqlite3.connect('db.sqlite')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
rows = cur.execute("SELECT dk.*, sv.ma as sv_ma, gv.ma as gv_ma, d.ten_dot as ten_dot FROM dang_ky dk JOIN users sv ON sv.id = dk.sv_id JOIN users gv ON gv.id = dk.gv_id JOIN dot d ON d.id = dk.dot_id WHERE dk.id=5").fetchall()
users = cur.execute('SELECT * FROM users').fetchall()
user_map = {u['id']: {'id': u['id'], 'ma': u['ma'], 'email': f"{u['ma']}@university.edu", 'ho_ten': u['ho_ten'], 'name': u['ho_ten'], 'role_raw': u['role'], 'role': u['role'], 'linh_vuc': u['linh_vuc'], 'heDaoTao': u['he_dao_tao']} for u in users}
r = rows[0]
print('row', dict(r))
try:
    gv_pb_id = int(r['gv_pb_id']) if r['gv_pb_id'] is not None else None
except Exception:
    gv_pb_id = None
try:
    chu_tich_id = int(r['chu_tich_id']) if r['chu_tich_id'] is not None else None
except Exception:
    chu_tich_id = None
try:
    thu_ky_id = int(r['thu_ky_id']) if r['thu_ky_id'] is not None else None
except Exception:
    thu_ky_id = None
uy_vien_ids = r['uy_vien_ids'] or '[]'
uy_vien_list = []
try:
    raw_list = json.loads(uy_vien_ids) if uy_vien_ids else []
    uy_vien_list = [int(uid) for uid in raw_list if str(uid).isdigit()]
except Exception as e:
    print('err', e)
    uy_vien_list = []
print('parsed', gv_pb_id, chu_tich_id, thu_ky_id, uy_vien_list)
ct_user = user_map.get(chu_tich_id)
tk_user = user_map.get(thu_ky_id)
tv_users = [user_map.get(uid) for uid in uy_vien_list if uid in user_map]
print('ct', ct_user)
print('tk', tk_user)
print('tv', tv_users)
print('hoiDong', {'ct': ct_user['email'], 'tk': tk_user['email'], 'tv': [u['email'] for u in tv_users]} if ct_user and tk_user and tv_users else None)
conn.close()
