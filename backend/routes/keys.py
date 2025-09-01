from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
import os
from typing import List

try:
    from dotenv import set_key, unset_key, load_dotenv
except Exception:  # pragma: no cover
    set_key = None  # type: ignore
    unset_key = None  # type: ignore
    load_dotenv = None  # type: ignore


router = APIRouter()


class ApiKeyIn(BaseModel):
    api_key: str


class ApiKeyOut(BaseModel):
    provider: str
    has_key: bool
    updated_at: str | None = None


KNOWN_PROVIDERS = [
    "openai",
    "anthropic",
    "google",
    "groq",
    "cohere",
    "mistral",
    "together",
    "perplexity",
    "fireworks",
]


def _has_env_key(provider: str) -> bool:
    provider = provider.lower()
    # Common mappings
    mapping = {
        "openai": ["OPENAI_API_KEY"],
        "anthropic": ["ANTHROPIC_API_KEY"],
        "google": ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
        "groq": ["GROQ_API_KEY"],
        "cohere": ["COHERE_API_KEY"],
        "mistral": ["MISTRAL_API_KEY"],
        "together": ["TOGETHER_API_KEY"],
        "perplexity": ["PERPLEXITY_API_KEY"],
        "fireworks": ["FIREWORKS_API_KEY"],
    }
    names = mapping.get(provider, [f"{provider.upper()}_API_KEY"])
    return any(os.environ.get(n) for n in names)


@router.get("/", response_model=list[ApiKeyOut])
def list_keys():
    res: list[ApiKeyOut] = []
    # Include known providers
    for p in KNOWN_PROVIDERS:
        res.append(ApiKeyOut(provider=p, has_key=_has_env_key(p)))
    # Add custom providers from env of shape NAME_API_KEY
    for k in os.environ.keys():
        if not k.endswith("_API_KEY"):
            continue
        provider = k[:-8].lower()
        if provider in KNOWN_PROVIDERS:
            continue
        if all(r.provider != provider for r in res):
            res.append(ApiKeyOut(provider=provider, has_key=True))
    res.sort(key=lambda r: r.provider)
    return res


@router.put("/{provider}", response_model=ApiKeyOut)
def upsert_key(provider: str, body: ApiKeyIn):
    provider = provider.lower().strip()
    if not provider:
        raise HTTPException(status_code=400, detail="Provider required")
    # Save under backend/.env.local so backend loader picks it up
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
    env_key = f"{provider.upper()}_API_KEY"
    try:
        if set_key is None:
            raise RuntimeError("python-dotenv not installed")
        set_key(str(env_path), env_key, body.api_key, quote_mode="always")
        if provider == "google":
            set_key(str(env_path), "GEMINI_API_KEY", body.api_key, quote_mode="always")
        # Refresh process env so subsequent runs see the key without restart
        if load_dotenv is not None:
            load_dotenv(env_path, override=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write env: {e}")
    return ApiKeyOut(provider=provider, has_key=True)


@router.delete("/{provider}")
def delete_key(provider: str):
    provider = provider.lower().strip()
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
    env_key = f"{provider.upper()}_API_KEY"
    try:
        if unset_key is None:
            raise RuntimeError("python-dotenv not installed")
        unset_key(str(env_path), env_key)
        if provider == "google":
            unset_key(str(env_path), "GEMINI_API_KEY")
        # Remove from current process env too
        os.environ.pop(env_key, None)
        if provider == "google":
            os.environ.pop("GEMINI_API_KEY", None)
        if load_dotenv is not None:
            load_dotenv(env_path, override=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update env: {e}")
    return {"ok": True}
