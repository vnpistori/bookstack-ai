from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.api.v1.api import api_router
from app.core.database import create_db_and_tables, sync_sequences

app = FastAPI(title="Reading List API", version="1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
        "https://bookstack-ai.vercel.app",
        "https://bookstack-ai-api.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Uploads
UPLOAD_DIR = Path("uploads")
try:
    UPLOAD_DIR.mkdir(exist_ok=True)
except Exception:
    pass

if UPLOAD_DIR.exists():
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include Routers
app.include_router(api_router)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    sync_sequences()


@app.get("/")
def read_root():
    from fastapi.responses import RedirectResponse

    return RedirectResponse(url="/docs")
