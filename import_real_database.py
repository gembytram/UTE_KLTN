from import_real_data import run_import
from database import USE_POSTGRES


if __name__ == "__main__":
    if not USE_POSTGRES:
        raise RuntimeError(
            "Project đã chuyển PostgreSQL-only. Hãy set DATABASE_URL trước khi import dữ liệu."
        )
    run_import(delete_old_db=False)
