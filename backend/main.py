from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.flows import router as flows_router
from routes.keys import router as keys_router

# Load .env files (root/.env.local, root/.env)
try:
    from dotenv import load_dotenv  # type: ignore
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    # Load backend/.env.local first, then backend/.env
    load_dotenv(root / ".env.local")
    load_dotenv(root / ".env")
except Exception:
    pass


app = FastAPI(title="DSPY Builder API", version="0.1.0")

# CORS for Next.js dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(flows_router, prefix="/api/flows", tags=["flows"])
app.include_router(keys_router, prefix="/api/keys", tags=["keys"])
