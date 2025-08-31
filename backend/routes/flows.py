from typing import List
from fastapi import APIRouter, HTTPException
import sqlite3

from app.db import get_connection, init_db
from app.schemas import FlowOut, FlowCreate, FlowUpdate
from app.utils import now_iso, new_id, slugify


router = APIRouter()


def ensure_db():
    init_db()


@router.get("/", response_model=List[FlowOut])
def list_flows():
    ensure_db()
    with get_connection() as conn:
        cur = conn.execute(
            "SELECT id, name, slug, created_at, updated_at FROM flows ORDER BY created_at DESC"
        )
        rows = [dict(row) for row in cur.fetchall()]
        return rows


@router.post("/", response_model=FlowOut)
def create_flow(payload: FlowCreate):
    ensure_db()
    flow_id = new_id()
    created_at = updated_at = now_iso()
    base_slug = slugify(payload.name)
    slug = _unique_slug(base_slug)

    with get_connection() as conn:
        conn.execute(
            "INSERT INTO flows (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (flow_id, payload.name, slug, created_at, updated_at),
        )
        conn.commit()
    return FlowOut(id=flow_id, name=payload.name, slug=slug, created_at=created_at, updated_at=updated_at)


@router.get("/{flow_id}", response_model=FlowOut)
def get_flow(flow_id: str):
    ensure_db()
    with get_connection() as conn:
        cur = conn.execute(
            "SELECT id, name, slug, created_at, updated_at FROM flows WHERE id = ?",
            (flow_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Flow not found")
        return dict(row)


@router.patch("/{flow_id}", response_model=FlowOut)
def rename_flow(flow_id: str, payload: FlowUpdate):
    ensure_db()
    with get_connection() as conn:
        # validate existence
        cur = conn.execute("SELECT slug FROM flows WHERE id = ?", (flow_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Flow not found")

        new_slug_base = slugify(payload.name)
        slug = _unique_slug(new_slug_base, exclude_id=flow_id)
        updated_at = now_iso()
        conn.execute(
            "UPDATE flows SET name = ?, slug = ?, updated_at = ? WHERE id = ?",
            (payload.name, slug, updated_at, flow_id),
        )
        conn.commit()

        cur = conn.execute(
            "SELECT id, name, slug, created_at, updated_at FROM flows WHERE id = ?",
            (flow_id,),
        )
        return dict(cur.fetchone())


@router.delete("/{flow_id}")
def delete_flow(flow_id: str):
    ensure_db()
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM flows WHERE id = ?", (flow_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Flow not found")
        conn.commit()
    return {"ok": True}


def _unique_slug(base: str, exclude_id: str | None = None) -> str:
    """Ensure slug uniqueness by suffixing -2, -3, ... when needed."""
    with get_connection() as conn:
        slug = base
        idx = 1
        while True:
            params: tuple = (slug,)
            query = "SELECT id FROM flows WHERE slug = ?"
            if exclude_id:
                query += " AND id != ?"
                params = (slug, exclude_id)
            cur = conn.execute(query, params)
            row = cur.fetchone()
            if not row:
                return slug
            idx += 1
            slug = f"{base}-{idx}"

