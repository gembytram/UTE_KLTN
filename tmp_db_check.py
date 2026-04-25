import sqlite3
from pathlib import Path
path = Path('db.sqlite')
print('DB exists:', path.exists())
if not path.exists():
    raise SystemExit(1)
conn = sqlite3.connect('db.sqlite')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
rows = cur.execute('SELECT id, ma, ho_ten, role, mat_khau FROM users LIMIT 20').fetchall()
print('Row count:', len(rows))
for row in rows:
    print(dict(row))
conn.close()