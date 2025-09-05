from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal, List, Optional
import os


router = APIRouter()


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.3


class ChatResponse(BaseModel):
    content: str


def _chat_openai(req: ChatRequest) -> ChatResponse:
    try:
        from openai import OpenAI  # type: ignore
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"OpenAI client not installed: {e}")
    try:
        client = OpenAI()
        comp = client.chat.completions.create(
            model=req.model,
            messages=[{"role": m.role, "content": m.content} for m in req.messages],
            temperature=req.temperature or 0.3,
        )
        content = comp.choices[0].message.content or ""
        return ChatResponse(content=content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error (OpenAI): {e}")


def _chat_gemini(req: ChatRequest) -> ChatResponse:
    try:
        import google.generativeai as genai  # type: ignore
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Gemini client not installed: {e}")

    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing GOOGLE_API_KEY or GEMINI_API_KEY")
    try:
        genai.configure(api_key=api_key)
        system_msgs = [m.content for m in req.messages if m.role == "system"]
        system_instruction = "\n\n".join(system_msgs) if system_msgs else None
        model = genai.GenerativeModel(model_name=req.model, system_instruction=system_instruction)
        contents = []
        for m in req.messages:
            if m.role == "system":
                continue  # handled via system_instruction
            role = "user" if m.role == "user" else "model"
            contents.append({"role": role, "parts": [m.content]})
        resp = model.generate_content(contents)
        # google-generativeai returns .text when available
        text = getattr(resp, "text", None)
        if not text:
            # Fallback: try candidates
            try:
                text = resp.candidates[0].content.parts[0].text  # type: ignore[attr-defined]
            except Exception:
                text = ""
        return ChatResponse(content=text or "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error (Gemini): {e}")


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    model_l = (req.model or "").lower()
    if model_l.startswith("gemini") or model_l.startswith("google/"):
        return _chat_gemini(req)
    # default to OpenAI-compatible
    return _chat_openai(req)
