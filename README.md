# Hệ Thống Quản Lý BCTT - KLTN

Ứng dụng web quản lý **Báo Cáo Thực Tập (BCTT)** và **Khóa Luận Tốt Nghiệp (KLTN)** cho Khoa Công Nghệ Thông Tin, Trường Đại Học Công Nghệ TPHCM.

---

## 📋 Mục Lục

- [Tổng Quan](#tổng-quan)
- [Tính Năng Chính](#tính-năng-chính)
- [Cấu Trúc Thư Mục](#cấu-trúc-thư-mục)
- [Yêu Cầu Môi Trường](#yêu-cầu-môi-trường)
- [Cài Đặt & Khởi Tạo](#cài-đặt--khởi-tạo)
- [Chạy Hệ Thống](#chạy-hệ-thống)
- [Cấu Hình Cơ Sở Dữ Liệu](#cấu-hình-cơ-sở-dữ-liệu)
- [Cấu Hình Xác Thực Google OAuth](#cấu-hình-xác-thực-google-oauth)
- [API Documentation](#api-documentation)
- [Triển Khai](#triển-khai)

---

## 🎯 Tổng Quan

Hệ thống gồm **3 phần chính**:

1. **Backend**: Flask API (Python) + SQLite/PostgreSQL
2. **Frontend**: HTML/CSS/JavaScript 
3. **Scripts**: Node.js để tạo file DOCX (Biên bản, Phiếu chấm điểm)

### Các Vai Trò Người Dùng

- **SV** - Sinh Viên: Đăng ký đề tài, nộp bài, xem kết quả
- **GV** - Giáo Viên: Hướng dẫn sinh viên, chấm điểm
- **TBM** - Trưởng Bộ Môn: Phê duyệt đề tài, quản lý đợt, xuất báo cáo

---

## ✨ Tính Năng Chính

### Xác Thực & Phân Quyền
- ✅ Đăng nhập bằng tài khoản trường hoặc Google OAuth
- ✅ Phân quyền theo vai trò (SV, GV, TBM)
- ✅ Quản lý phiên làm việc an toàn

### Quản Lý Đề Tài
- ✅ Sinh viên đăng ký BCTT/KLTN
- ✅ Trưởng bộ môn duyệt/từ chối đề tài
- ✅ Phân công giáo viên hướng dẫn và chấm điểm
- ✅ Tổ chức hội đồng chấm điểm (cho KLTN)

### Nộp Bài & Quản Lý File
- ✅ Nộp bài viết (PDF, DOC, DOCX)
- ✅ Upload hồ sơ (giấy tờ, báo cáo, v.v.)
- ✅ Upload file Turnitin (kiểm tra sao chép)
- ✅ Lưu trữ tập trung các file upload

### Chấm Điểm & Báo Cáo
- ✅ Giáo viên chấm điểm (hướng dẫn + phản biện)
- ✅ Tính điểm tổng hợp tự động
- ✅ Xuất báo cáo, thống kê
- ✅ Tạo file DOCX (Biên bản, Phiếu chấm điểm)

### Thông Báo
- ✅ Thông báo nội bộ cho người dùng
- ✅ Cập nhật trạng thái đề tài

---

## 📁 Cấu Trúc Thư Mục

```
[QTDA] KLTN-FinalUI/
│
├── app.py                           # Entry point Flask
├── database.py                      # Schema và migration
├── build.py                         # Build script
├── requirements.txt                 # Python dependencies
├── package.json                     # Node.js dependencies
│
├── api/
│   ├── __init__.py
│   └── routes.py                    # API endpoints
│
├── config/
│   ├── __init__.py
│   └── settings.py                  # Cấu hình ứng dụng
│
├── services/                        # Business logic
│   ├── __init__.py
│   ├── auth.py                      # Xác thực & phân quyền
│   ├── bootstrap_service.py         # Khởi tạo dữ liệu
│   └── kltn_service.py              # Logic quản lý KLTN
│
├── utils/                           # Hàm tiện ích
│   ├── __init__.py
│   ├── helpers.py                   # Helper functions
│   └── response.py                  # Response utils
│
├── frontend/                        # Giao diện người dùng
│   ├── index.html                   # Trang chính
│   ├── css/
│   │   └── styles.css               # CSS styles
│   ├── js/
│   │   └── app.js                   # Frontend logic
│   └── (assets - hình ảnh, font, v.v.)
│
├── scripts/
│   └── node/
│       ├── gen_bien_ban.js          # Tạo file Biên bản DOCX
│       └── gen_cham_diem.js         # Tạo file Phiếu chấm điểm DOCX
│
├── uploads/                         # Thư mục lưu file upload
│   ├── bctt_baocao/
│   ├── bctt_xacnhan/
│   ├── bien_ban_cham_diem/
│   ├── bien_ban_giai_trinh/
│   ├── bien_ban_tk/
│   ├── kltn_bai/
│   ├── kltn_bai_pdf/
│   ├── kltn_bai_word/
│   ├── kltn_chinhsua/
│   ├── turnitin/
│   └── turnitin_bctt/
│
├── db.sqlite                        # SQLite database (local)
├── .venv/                           # Python virtual environment
│
└── README.md                        # File này
```

---

## 📦 Yêu Cầu Môi Trường

- **Python**: 3.10+
- **Node.js**: 18+
- **npm**: 8+
- **Hệ quản trị DB**: SQLite (local) hoặc PostgreSQL (production)

### Python Dependencies

```
Flask==2.3.3
flask-cors==4.0.0
Werkzeug==2.3.7
gunicorn==21.2.0
python-dotenv==1.0.0
psycopg2-binary==2.9.9
authlib==1.3.0
requests==2.31.0
```

### Node.js Dependencies

```
docx@^9.6.1
```

---

## 🚀 Cài Đặt & Khởi Tạo

### Bước 1: Clone Repository

```bash
git clone <repository-url>
cd "[QTDA] KLTN-FinalUI"
```

### Bước 2: Tạo Virtual Environment (Python)

**Windows (PowerShell)**:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**macOS/Linux**:
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Bước 3: Cài Đặt Python Dependencies

```bash
pip install -r requirements.txt
```

### Bước 4: Cài Đặt Node.js Dependencies

```bash
npm install
```

### Bước 5: Khởi Tạo Cơ Sở Dữ Liệu

```bash
python database.py
```

Lệnh này sẽ tạo file `db.sqlite` với schema ban đầu.

### Bước 6: Import Dữ Liệu (Tùy Chọn)

Để import dữ liệu từ Google Sheet:

```bash
python import_real_data.py
```

---

## 🏃 Chạy Hệ Thống

### Khởi Động Backend

```bash
python app.py
```

Backend sẽ chạy tại:
- **URL**: `http://127.0.0.1:5000`
- **Frontend**: `http://127.0.0.1:5000/` (được serve từ thư mục `frontend/`)

### Kiểm Tra Backend

Mở trình duyệt và truy cập:
```
http://127.0.0.1:5000
```

---

## 🗄️ Cấu Hình Cơ Sở Dữ Liệu

### SQLite (Local/Development)

Mặc định sử dụng SQLite, không cần cấu hình thêm.

### PostgreSQL (Production)

Để sử dụng PostgreSQL, thiết lập biến môi trường:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/kltn_db"
```

Hoặc tạo file `.env`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/kltn_db
```

Hệ thống sẽ tự động phát hiện PostgreSQL và sử dụng nó thay cho SQLite.

---

## 🔐 Cấu Hình Xác Thực Google OAuth

### 1. Tạo Google OAuth Credentials

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project hiện có
3. Kích hoạt **Google+ API**
4. Tạo **OAuth 2.0 Client ID** (loại: Web Application)
5. Thêm Authorized redirect URIs:
   - `http://127.0.0.1:5000/api/auth/google/callback` (local)
   - `https://your-domain.com/api/auth/google/callback` (production)

### 2. Cấu Hình Biến Môi Trường

Tạo hoặc chỉnh sửa file `.env`:

```
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:5000/api/auth/google/callback
FRONTEND_URL=http://127.0.0.1:5500/frontend/index.html
```

### 3. Kích Hoạt OAuth

Backend sẽ tự động kích hoạt OAuth nếu `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` được cấu hình.

---

## 📚 API Documentation

### Authentication Endpoints

#### Đăng Nhập Cục Bộ
```http
POST /api/login
Content-Type: application/json

{
  "ma": "23126077",
  "mat_khau": "password"
}
```

#### Đăng Nhập Google OAuth
```
GET /api/auth/google/login
```

#### Đăng Xuất
```http
POST /api/logout
```

### Bootstrap Data
```http
GET /api/bootstrap
```

Trả về dữ liệu khởi tạo: người dùng, đợt, đề tài, v.v.

### Quản Lý Đề Tài

#### Lấy danh sách đề tài
```http
GET /api/dang_ky
```

#### Đăng ký đề tài
```http
POST /api/dang_ky
Content-Type: application/json

{
  "loai": "BCTT" | "KLTN",
  "nganh": "ATTT",
  "de_tai": "Tên đề tài",
  ...
}
```

### Nộp Bài
```http
POST /api/nop_bai
Content-Type: multipart/form-data

- file: <file>
- loai_file: 'kltn_bai' | 'bctt_baocao' | 'turnitin'
- dang_ky_id: <id>
```

### Chấm Điểm
```http
POST /api/cham_diem
Content-Type: application/json

{
  "dang_ky_id": <id>,
  "diem_huong_dan": 8.5,
  "diem_phan_bien": 7.5,
  ...
}
```

---

## 📤 Triển Khai

### Triển Khai trên Vercel

Xem file [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md) để hướng dẫn chi tiết.

### Triển Khai trên Server Linux

1. **Cài đặt Python, Node.js**
   ```bash
   sudo apt-get update
   sudo apt-get install python3 python3-pip nodejs npm
   ```

2. **Clone và setup**
   ```bash
   git clone <repo-url>
   cd "[QTDA] KLTN-FinalUI"
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   npm install
   ```

3. **Cấu hình PostgreSQL**
   ```bash
   sudo apt-get install postgresql
   # Tạo database và user
   ```

4. **Chạy với Gunicorn**
   ```bash
   gunicorn -w 4 -b 0.0.0.0:5000 app:app
   ```

5. **Cấu hình Nginx (reverse proxy)**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

---

## 🛠️ Scripts Tiện Ích

### Khởi Tạo Database
```bash
python database.py
```

### Import Dữ Liệu
```bash
python import_real_data.py
```

### Kiểm Tra Kết Nối PostgreSQL
```bash
python check_postgres_connection.py
```

### Build
```bash
python build.py
```

---

## 📝 Tệp Cấu Hình

### `.env` (Environment Variables)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/kltn_db
DB_PATH=/path/to/db.sqlite

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# Frontend
FRONTEND_URL=http://localhost:5500/frontend/index.html

# Admin
ADMIN_INIT_TOKEN=your-secure-token

# Vercel
VERCEL=1 (khi deploy trên Vercel)
```

---

## 🐛 Troubleshooting

### Lỗi "Module not found"
```bash
pip install -r requirements.txt
```

### Lỗi kết nối database
- Kiểm tra `DATABASE_URL` trong `.env`
- Kiểm tra PostgreSQL service đang chạy
- Xem [README_POSTGRES.md](README_POSTGRES.md)

### Lỗi Google OAuth
- Kiểm tra `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`
- Kiểm tra redirect URI trong Google Console
- Xem [readmeauthgg.md](readmeauthgg.md)

### Lỗi upload file
- Kiểm tra thư mục `uploads/` có quyền ghi
- Kiểm tra kích thước file (max 20MB)

---

## 📄 Tài Liệu Thêm

- [POSTGRES_SETUP.md](POSTGRES_SETUP.md) - Hướng dẫn cấu hình PostgreSQL
- [README_POSTGRES.md](README_POSTGRES.md) - Thông tin PostgreSQL
- [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md) - Triển khai trên Vercel
- [readmeauthgg.md](readmeauthgg.md) - Hướng dẫn Google OAuth

---

## 📞 Liên Hệ & Hỗ Trợ

Để báo cáo bug hoặc yêu cầu tính năng, vui lòng liên hệ:
- Email: admin@your-domain.com
- GitHub Issues: [Project Issues](https://github.com/your-repo/issues)

---

## 📜 License

Dự án này được phát triển cho Khoa Công Nghệ Thông Tin, ĐHCN TPHCM.

---

**Lần cập nhật cuối**: 29/04/2026

### Frontend

Co 2 cach:

1. Mo truc tiep file `frontend/index.html`
2. Khuyen nghi: dung local server

```powershell
python -m http.server 5500 -d frontend
```

Frontend URL:
- http://127.0.0.1:5500

Luu y: frontend dang goi API den `http://127.0.0.1:5000`.

## Tai khoan va dang nhap

- Mat khau mac dinh thuong la: `123456`
- Co the dang nhap bang ma (MSSV/MAGV) hoac email tuy bo du lieu import
- Vai tro trong he thong:
  - SV: Sinh vien
  - GV: Giang vien
  - TBM: Truong bo mon

## Quick Start

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install flask flask-cors
npm install
python import_real_data.py
python app.py
```

Sau do mo them 1 terminal khac de chay frontend:

```powershell
python -m http.server 5500 -d frontend
```

## Cac loi thuong gap trong web nguyen thi tram 

### 1) ModuleNotFoundError: flask / flask_cors

Nguyen nhan: chua cai package Python trong moi truong dang dung.

Khac phuc:

```powershell
pip install flask flask-cors
```

### 2) Frontend mo duoc nhung API loi

Nguyen nhan:
- Backend chua chay
- Sai cong hoac sai API base

Khac phuc:
- Dam bao `python app.py` dang chay o cong 5000
- Kiem tra frontend dang goi dung `http://127.0.0.1:5000`

### 3) Loi xuat file DOCX

Nguyen nhan:
- Chua cai node dependencies
- Loi runtime Node

Khac phuc:

```powershell
npm install
```

## Ghi chu ky thuat

- Database: SQLite (`db.sqlite`)
- Gioi han upload: 20MB
- File upload chap nhan: PDF, DOC, DOCX
- Session login su dung cookie cua Flask

