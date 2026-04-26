#!/usr/bin/env python3
"""Build script for Vercel deployment - khởi tạo database."""

import os
import sys

# Chỉ chạy khởi tạo nếu cần
def main():
    print("🔨 Vercel Build: Chuẩn bị khởi tạo database...")
    
    # Trên Vercel, db sẽ được khởi tạo khi app chạy lần đầu
    # Bạn có thể import init_db ở đây nếu muốn
    # Tuy nhiên chúng tôi khuyến nghị khởi tạo trong app.py khi cần
    
    print("✅ Build script hoàn tất")

if __name__ == "__main__":
    main()
