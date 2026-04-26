# 📋 Hướng dẫn Deploy lên Vercel

## 1️⃣ LOCAL: Khởi tạo dữ liệu

```powershell
# Tạo virtualenv
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Cài dependencies
pip install flask flask-cors

# Khởi tạo database + import dữ liệu từ Google Sheet
python import_real_data.py

# Chạy server local
python app.py
```

**Kết quả:** `db.sqlite` sẽ được tạo ở thư mục gốc với dữ liệu từ Google Sheet.

---

## 2️⃣ VERCEL: 3 Cách khởi tạo Database

### ⚠️ Vấn đề trên Vercel
- Vercel là **serverless** → chỉ có `/tmp` là tạm thời (mất sau mỗi restart)
- File `db.sqlite` không bền vĩnh viễn trên Vercel
- **Khuyến nghị:** Dùng **PostgreSQL / MySQL / Supabase** (xem Cách 3)

---

### **Cách 1: SQLite tạm thời trên Vercel** (chỉ test)

#### Setup:
1. Tạo file `.env.production` trên Vercel:
   ```
   DB_PATH=/tmp/db.sqlite
   ADMIN_INIT_TOKEN=your-secret-admin-token
   ```

2. Sau khi deploy, gọi endpoint khởi tạo:
   ```bash
   curl -X POST https://your-vercel-app.vercel.app/api/admin/init-db \
     -H "Authorization: Bearer your-secret-admin-token" \
     -H "Content-Type: application/json"
   ```

3. **Hạn chế:** Dữ liệu mất khi Vercel restart instance

---

### **Cách 2: Upload & commit `db.sqlite` lên GitHub** (quick & dirty)

#### Setup:
1. Tạo sẵn `db.sqlite` local:
   ```powershell
   python import_real_data.py
   ```

2. Commit vào GitHub:
   ```bash
   git add db.sqlite
   git commit -m "Add initial database"
   git push
   ```

3. Vercel sẽ pull `db.sqlite` từ repo

#### ⚠️ Hạn chế:
- Database có thể cũ nếu dữ liệu thay đổi
- Commit file lớn không tốt cho Git
- Mỗi lần update data cần push lại

---

### **Cách 3: PostgreSQL / MySQL** (✅ Recommended)

#### Setup:
1. Chọn một trong những cái sau:
   - **Supabase** (PostgreSQL free tier) → https://supabase.com
   - **PlanetScale** (MySQL free tier) → https://planetscale.com
   - **Railway** (PostgreSQL/MySQL) → https://railway.app
   - **Neon** (PostgreSQL) → https://neon.tech

2. Lấy **Connection String** từ dịch vụ

3. Cài driver Python:
   ```bash
   pip install psycopg2-binary  # PostgreSQL
   # hoặc
   pip install PyMySQL  # MySQL
   ```

4. Sửa `database.py` để dùng PostgreSQL:
   ```python
   import psycopg2
   from psycopg2.extras import RealDictCursor
   
   DB_URL = os.environ.get("DATABASE_URL")
   
   def get_db():
       conn = psycopg2.connect(DB_URL)
       return conn
   ```

5. Set env var trên Vercel dashboard:
   ```
   DATABASE_URL=postgresql://user:pass@host/dbname
   ```

6. Deploy và khởi tạo:
   ```bash
   curl -X POST https://your-vercel-app.vercel.app/api/admin/init-db \
     -H "Authorization: Bearer your-secret-token"
   ```

---

## 3️⃣ So sánh các cách

| Cách | SQLite tạm | DB committed | PostgreSQL |
|------|-----------|-------------|-----------|
| **Dữ liệu bền** | ❌ | ✅ | ✅✅ |
| **Chi phí** | Free | Free | Free-tier |
| **Phức tạp** | Dễ | Dễ | Trung bình |
| **Phù hợp** | Test | Dev/Demo | Production |

---

## 4️⃣ Vercel Deploy Checklist

- [ ] Cài `python-dotenv` để load `.env`:
  ```bash
  pip install python-dotenv
  ```

- [ ] Trong `app.py`, load env vars:
  ```python
  from dotenv import load_dotenv
  load_dotenv()
  ```

- [ ] Cấu hình `vercel.json`:
  ```json
  {
    "buildCommand": "pip install -r requirements.txt",
    "env": {
      "VERCEL": "1"
    }
  }
  ```

- [ ] Push lên GitHub

- [ ] Link GitHub repo với Vercel dashboard

- [ ] Set env vars trên Vercel:
  - `DB_PATH` hoặc `DATABASE_URL`
  - `ADMIN_INIT_TOKEN`
  - `FLASK_ENV=production`

- [ ] Deploy

- [ ] Gọi khởi tạo endpoint

---

## 5️⃣ Quickstart cho Vercel (khuyến nghị)

**Bước 1:** Setup Supabase PostgreSQL (free)
```bash
# Tại https://supabase.com, tạo project mới
# Copy Connection String
```

**Bước 2:** Sửa `requirements.txt`:
```
flask
flask-cors
psycopg2-binary
```

**Bước 3:** Sửa `database.py` để dùng PostgreSQL (xem Cách 3 trên)

**Bước 4:** Deploy:
```bash
git push origin main  # Vercel tự deploy từ GitHub
```

**Bước 5:** Khởi tạo dữ liệu:
```bash
curl -X POST https://your-app.vercel.app/api/admin/init-db \
  -H "Authorization: Bearer your-secret-token"
```

---

## 🆘 Troubleshooting

**Lỗi:** `unable to open database file` trên Vercel
- **Nguyên nhân:** `/tmp` không tồn tại hoặc không có quyền ghi
- **Cách sửa:** Dùng PostgreSQL thay vì SQLite

**Lỗi:** `401 Unauthorized` khi gọi `/api/admin/init-db`
- **Nguyên nhân:** Token sai
- **Cách sửa:** Kiểm tra `ADMIN_INIT_TOKEN` env var

**Dữ liệu mất sau restart Vercel**
- **Nguyên nhân:** SQLite lưu trên `/tmp` (tạm)
- **Cách sửa:** Dùng external database (PostgreSQL)

---

## 📞 Support
Nếu gặp vấn đề, kiểm tra:
1. Logs trên Vercel dashboard
2. `.env` variables
3. Connection string đúng hay không
