# He Thong Quan Ly BCTT - KLTN

Ung dung quan ly de tai Bao cao thuc tap (BCTT) va Khoa luan tot nghiep (KLTN) cho Khoa FE.

#Test commit

## Tong quan

He thong gom 3 phan chinh:
- Backend Flask API + SQLite
- Frontend HTML/CSS/JS (thu muc frontend)
- Script Node.js de xuat bien ban/cham diem dang DOCX

## Tinh nang chinh cua web la 

- Dang nhap theo vai tro: SV, GV, TBM
- Dang ky BCTT/KLTN va duyet de tai
- Phan cong vai tro cham diem, hoi dong
- Nop bai, upload file ho so (PDF/DOC/DOCX)
- Cham diem, tong hop ket qua, thong ke
- Xuat file DOCX (bien ban, phieu cham diem)
- Thong bao noi bo cho nguoi dung

## Cau truc thu muc

```text
.
|- app.py                      # entrypoint backend Flask
|- database.py                 # tao schema + migration sqlite
|- import_real_data.py         # import du lieu tu Google Sheet
|- db.sqlite                   # database sqlite
|- api/
|  |- routes.py                # khai bao API routes
|- services/                   # business logic backend
|- utils/                      # helper/response dung chung
|- config/
|  |- settings.py              # app config
|- frontend/
|  |- index.html               # giao dien chinh
|  |- css/styles.css           # style
|  |- js/app.js                # logic frontend
|  |- bg.jpg, logo.png, ...    # static assets
|- scripts/
|  |- node/
|     |- gen_bien_ban.js       # tao bien ban DOCX
|     |- gen_cham_diem.js      # tao phieu cham diem DOCX
|- uploads/                    # noi luu file upload
|- package.json                # node deps (docx)
```

## Yeu cau moi truong

- Python 3.10+
- Node.js 18+
- npm

## Cai dat

Chay trong thu muc goc project.

### 1) Tao va kich hoat virtualenv

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2) Cai thu vien Python

```powershell
pip install flask flask-cors
```

### 3) Cai thu vien Node.js

```powershell
npm install
```

## Khoi tao du lieu

Du lieu duoc import bang script:

```powershell
python import_real_data.py
```

Sau khi chay xong, `db.sqlite` se duoc tao/cap nhat.

## Chay he thong

### Backend

```powershell
python app.py
```

Backend mac dinh chay tai:
- http://127.0.0.1:5000

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

## Cac loi thuong gap

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

