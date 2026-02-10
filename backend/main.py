from fastapi import FastAPI, HTTPException, Depends, status, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from database import engine, get_db
import models
import auth
import os
import json
from apscheduler.schedulers.background import BackgroundScheduler
from services import rates_scraper

# Data directory (auto-detected in database.py)
from database import DATA_DIR

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Scheduler Setup
scheduler = BackgroundScheduler()

def scheduled_update():
    print("⏰ Running scheduled daily rate update...")
    rates_scraper.update_square_data()

# Schedule it daily at 09:00 AM
scheduler.add_job(scheduled_update, 'cron', hour=9, minute=0)
scheduler.start()

@app.on_event("startup")
def check_rates_freshness():
    """Checks if rates are missing or stale (>24h) on startup."""
    print("🔍 Checking rates freshness on startup...")
    
    rates_file = os.path.join(DATA_DIR, 'rates.json')
    should_update = False
    
    if not os.path.exists(rates_file):
        print("⚠️ rates.json not found. Updating immediately.")
        should_update = True
    else:
        try:
            with open(rates_file, 'r') as f:
                data = json.load(f)
                last_update_str = data.get("last_update")
                if last_update_str:
                    last_update = datetime.strptime(last_update_str, "%Y-%m-%d %H:%M:%S")
                    if last_update.date() != datetime.now(timezone.utc).date():
                        print(f"⚠️ Rates are from a previous day ({last_update.date()}). Updating immediately.")
                        should_update = True
                    else:
                        print(f"✅ Rates are from today ({last_update_str}).")
                else:
                    should_update = True
        except Exception as e:
            print(f"⚠️ Error reading rates.json: {e}. Updating immediately.")
            should_update = True
            
    if should_update:
        rates_scraper.update_square_data()


# ── API Router (all endpoints under /api/) ──────────────────────────

router = APIRouter(prefix="/api")


# Pydantic Schemas
class UserCreate(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TransactionCreate(BaseModel):
    description: str
    amount: float
    type: str


class TransactionResponse(BaseModel):
    id: int
    description: str
    amount: float
    type: str
    date: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: str = None
    password: str = None


# Rates Endpoints
@router.get("/rates")
def get_rates():
    """Return current rates from /data/rates.json"""
    rates_file = os.path.join(DATA_DIR, 'rates.json')
    if os.path.exists(rates_file):
        with open(rates_file, 'r') as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="Rates not available")


@router.get("/rates/history")
def get_rates_history():
    """Return historical rates from /data/rates_history.json"""
    history_file = os.path.join(DATA_DIR, 'rates_history.json')
    if os.path.exists(history_file):
        with open(history_file, 'r') as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="History not available")


# Auth Endpoints
@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    # Check if username exists
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Create user
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        username=user.username,
        hashed_password=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_current_user(
    user_update: UserUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Check if new username is taken by another user
    if user_update.username and user_update.username != current_user.username:
        existing = db.query(models.User).filter(models.User.username == user_update.username).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = user_update.username
    
    # Update password if provided
    if user_update.password:
        current_user.hashed_password = auth.get_password_hash(user_update.password)
    
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me")
def delete_current_user(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Delete all user's transactions first
    db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id).delete()
    # Delete the user
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted successfully"}


# Transaction Endpoints (Protected)
@router.get("/transactions", response_model=List[TransactionResponse])
def get_transactions(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id).all()


@router.post("/transactions", response_model=TransactionResponse)
def create_transaction(
    transaction: TransactionCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    new_transaction = models.Transaction(
        description=transaction.description,
        amount=transaction.amount,
        type=transaction.type,
        user_id=current_user.id
    )
    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)
    return new_transaction


@router.delete("/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    transaction = db.query(models.Transaction).filter(
        models.Transaction.id == transaction_id,
        models.Transaction.user_id == current_user.id
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    db.delete(transaction)
    db.commit()
    return {"message": "Transaction deleted"}


# Include the API router
app.include_router(router)


# Health check endpoint (outside /api/ for simplicity)
@app.get("/health")
def health_check():
    return {"status": "healthy"}


# ── Serve React SPA in production ────────────────────────────────────
# If a 'static' directory exists (created during Docker build),
# serve the built React frontend from it.

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    # Serve static assets (JS, CSS, images) from /assets/
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Serve other static files (manifest, sw.js, icons, etc.)
    app.mount("/icons", StaticFiles(directory=os.path.join(static_dir, "icons")), name="icons")

    @app.get("/manifest.json")
    async def serve_manifest():
        return FileResponse(os.path.join(static_dir, "manifest.json"))

    @app.get("/sw.js")
    async def serve_sw():
        return FileResponse(os.path.join(static_dir, "sw.js"))

    # SPA catch-all: serve index.html for any non-API, non-asset route
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # If a file exists at the requested path, serve it
        file_path = os.path.join(static_dir, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise serve index.html for SPA routing
        return FileResponse(os.path.join(static_dir, "index.html"))
