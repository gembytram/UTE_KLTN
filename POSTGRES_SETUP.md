# Chuyen he thong sang PostgreSQL local

Tai lieu nay dung cho project hien tai (raw SQL), khong dung Alembic.

## 1) Tao database moi

Mo SQL Shell (psql) bang user postgres, sau do chay:

```sql
CREATE DATABASE ute_kltn;
```

Neu ban muon ten khac, thay `ute_kltn` bang ten app cua ban.

## 2) Cai dependencies Python

```powershell
pip install -r requirements.txt
```

## 3) Cau hinh chuoi ket noi PostgreSQL

### Cach A: Set bien moi truong (khuyen nghi)

```bat
setx DATABASE_URL "postgresql://postgres:123456@localhost:5432/ute_kltn"
```

Sau khi setx, mo terminal moi hoac mo lai VS Code.

### Cach B: Set tam cho phien hien tai (chi hieu luc trong cua so dang mo)

```bat
set DATABASE_URL=postgresql://postgres:123456@localhost:5432/ute_kltn
```

## 4) Tao schema bang tren PostgreSQL

```powershell
python app.py
```

Backend se tu dong chay `init_db()` va tao toan bo bang tren PostgreSQL khi `DATABASE_URL` da duoc set.

## 5) Import du lieu

```powershell
python import_real_data.py
```

Khi dang dung PostgreSQL, script import se khong xoa `db.sqlite` nua va se import truc tiep vao PostgreSQL.

## 6) Kiem tra nhanh

Mo psql va chay:

```sql
\c ute_kltn
\dt
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM dot;
```

## 7) Neu muon quay lai SQLite

Xoa bien `DATABASE_URL` (hoac mo terminal khac khong co bien nay), app se quay ve che do SQLite nhu cu.
