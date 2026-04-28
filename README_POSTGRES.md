# Huong dan chuyen database tu SQLite sang PostgreSQL (Local)

Tai lieu nay dung cho team setup local nhanh voi PostgreSQL.

## 1. Yeu cau

- Da cai PostgreSQL va dang chay service local
- Python dependencies da cai tu `requirements.txt`
- Project nay da duoc cau hinh PostgreSQL-only

## 2. Tao database moi

### Cach 1: dung pgAdmin (khuyen nghi)

1. Mo pgAdmin
2. Login user `postgres`
3. Chuot phai vao `Databases` -> `Create` -> `Database...`
4. Dat ten database, vi du: `ute_kltn`
5. Save

### Cach 2: dung SQL Shell (psql)

Neu may co `psql`, chay:

```sql
CREATE DATABASE ute_kltn;
```

## 3. Cau hinh bien moi truong DATABASE_URL

### Tren CMD (luu vao Windows user env)

```bat
setx DATABASE_URL "postgresql://postgres:123456@localhost:5432/ute_kltn"
```

Sau khi chay `setx`, phai mo terminal moi (hoac mo lai VS Code) de bien co hieu luc.

### Kiem tra bien da ton tai

```powershell
Get-ChildItem Env:DATABASE_URL
```

## 4. Kiem tra ket noi PostgreSQL tu project

Project da co script:

```powershell
python check_postgres_connection.py
```

Ket qua mong doi:
- `Kết nối PostgreSQL thành công`
- Hien ten database va user dang ket noi

## 5. Import du lieu vao database moi

Chay script import cho PostgreSQL:

```powershell
python import_real_database.py
```

Script se:
- Tao schema bang neu chua co
- Import users, dot, slots, ... vao PostgreSQL

## 6. Chay backend

```powershell
python app.py
```

Neu thanh cong, log se hien:
- `Database initialized on PostgreSQL!`

## 7. Kiem tra nhanh tren pgAdmin

Sau khi import:
- Refresh schema `public`
- Kiem tra cac bang: `users`, `dot`, `gv_slot`, `dang_ky`, `nop_bai`, `cham_diem`, `thong_bao`
- Kiem tra so dong bang `users`

## 8. Loi thuong gap va cach xu ly

### Loi: `psql is not recognized`

Nguyen nhan: `psql` chua co trong PATH.

Cach xu ly:
- Dung pgAdmin de tao database (khong can psql)
- Hoac them thu muc `bin` cua PostgreSQL vao PATH

### Loi: `Chưa có DATABASE_URL`

Nguyen nhan: chua set bien hoac terminal chua nhan bien moi.

Cach xu ly:
1. Chay lai `setx DATABASE_URL ...`
2. Dong terminal cu
3. Mo terminal moi va chay lai `python check_postgres_connection.py`

### Loi: `Kết nối PostgreSQL thất bại`

Kiem tra:
- PostgreSQL service da chay chua
- Username/password co dung khong
- DB `ute_kltn` da tao chua
- Port co dung `5432` khong

## 9. Lenh setup nhanh (copy-paste)

```bat
setx DATABASE_URL "postgresql://postgres:123456@localhost:5432/ute_kltn"
```

Mo terminal moi, sau do:

```powershell
pip install -r requirements.txt
python check_postgres_connection.py
python import_real_database.py
python app.py
```
