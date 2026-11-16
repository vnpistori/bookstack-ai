from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import traceback

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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Garante que exceções não tratadas sejam logadas no Vercel com traceback e retornem CORS headers."""
    error_trace = traceback.format_exc()
    print(f"[UNHANDLED_ERROR] {request.method} {request.url.path}: {exc}\n{error_trace}")

    origin = request.headers.get("origin")
    headers = {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    }
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
    else:
        headers["Access-Control-Allow-Origin"] = "*"

    return JSONResponse(
        status_code=500,
        content={"detail": f"Erro interno no servidor: {str(exc)}"},
        headers=headers,
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
