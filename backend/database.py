from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Pick a writable data directory
def _get_data_dir():
    # Allow override via env var
    if os.environ.get("DATABASE_DIR"):
        d = os.environ["DATABASE_DIR"]
        os.makedirs(d, exist_ok=True)
        return d
    # Try /data first (production volume mount)
    for candidate in ["/data", "/tmp/data"]:
        try:
            os.makedirs(candidate, exist_ok=True)
            # Test if writable
            test_file = os.path.join(candidate, ".write_test")
            with open(test_file, "w") as f:
                f.write("ok")
            os.remove(test_file)
            return candidate
        except (OSError, PermissionError):
            continue
    # Last resort: current working directory
    fallback = os.path.join(os.getcwd(), "data")
    os.makedirs(fallback, exist_ok=True)
    return fallback

DATA_DIR = _get_data_dir()
print(f"📂 Using data directory: {DATA_DIR}")

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DATA_DIR}/budget.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
