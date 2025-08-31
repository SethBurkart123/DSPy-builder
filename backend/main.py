from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.flows import router as flows_router


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
