from fastapi import APIRouter, HTTPException, Response
from pathlib import Path
import tempfile
import hashlib
import requests

router = APIRouter()

CACHE_DIR = Path(tempfile.gettempdir()) / "image_cache"
try:
    CACHE_DIR.mkdir(exist_ok=True)
except Exception:
    pass


def _get_cached_image(cache_path: Path, url: str):
    try:
        if cache_path.exists():
            content_type = "image/jpeg"
            if url.lower().endswith(".png"):
                content_type = "image/png"
            elif url.lower().endswith(".webp"):
                content_type = "image/webp"
            return Response(content=cache_path.read_bytes(), media_type=content_type)
    except Exception:
        pass
    return None


def _fetch_and_cache_image(url: str, cache_path: Path):
    try:
        response = requests.get(url, stream=True, timeout=10)
        if response.status_code != 200:
            return None, "Failed to fetch image"

        content = response.content
        try:
            cache_path.write_bytes(content)
        except Exception:
            pass  # ignore cache write errors

        return (
            Response(
                content=content,
                media_type=response.headers.get("Content-Type", "image/jpeg"),
            ),
            None,
        )
    except Exception as e:
        return None, str(e)


@router.get("/proxy/image")
async def proxy_image(url: str):
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    url_hash = hashlib.md5(url.encode()).hexdigest()
    cache_path = CACHE_DIR / url_hash

    # 1. Tenta Cache
    cached = _get_cached_image(cache_path, url)
    if cached:
        cached.headers["Access-Control-Allow-Origin"] = "*"
        cached.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        cached.headers["Access-Control-Allow-Headers"] = "*"
        return cached

    # 2. Busca
    response, error = _fetch_and_cache_image(url, cache_path)
    if response:
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response


@router.options("/proxy/image")
async def proxy_image_options():
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        },
    )


@router.get("/health")
def health_check():
    """Verifica status da API, Banco de Dados e Variáveis de Ambiente."""
    from app.core.database import engine
    from sqlmodel import Session, select
    import os

    status = {"status": "ok", "database": "unknown", "env_vars": {}}

    # 1. Check Database
    try:
        with Session(engine) as session:
            session.exec(select(1)).first()
            status["database"] = "connected"
    except Exception as e:
        status["database"] = f"error: {str(e)}"
        status["status"] = "error"

    # 2. Check Critical Env Vars (Masked)
    critical_checks = [
        ("DATABASE_URL", os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")),
        ("SUPABASE_URL", os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")),
        ("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY")),
        ("ENCRYPTION_KEY", os.getenv("ENCRYPTION_KEY")),
    ]

    for name, val in critical_checks:
        if val:
            masked = f"{val[:4]}...({len(val)} chars)"
        else:
            masked = "MISSING"
            if name != "ENCRYPTION_KEY":
                status["status"] = "error"
        status["env_vars"][name] = masked

    return status
