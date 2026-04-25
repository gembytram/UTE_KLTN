import sqlite3
conn = sqlite3.connect('db.sqlite')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
roles = cur.execute('SELECT role, COUNT(*) AS cnt FROM users GROUP BY role').fetchall()
print([dict(r) for r in roles])
print('Sample SV:')
for row in cur.execute("SELECT id, ma, ho_ten, role, mat_khau FROM users WHERE role='SV' LIMIT 20").fetchall():
    print(dict(row))
conn.close()