from typing import AsyncGenerator, List
from fastapi import APIRouter, HTTPException, Request
from starlette.responses import StreamingResponse

from app.db import get_connection
from app.schemas import (
    FlowOut,
    FlowCreate,
    FlowUpdate,
    FlowStateOut,
    FlowStateIn,
    FlowSchemaIn,
    FlowSchemaOut,
    NodeRunIn,
    NodeRunOut,
)
from app.utils import now_iso, new_id, slugify


router = APIRouter()


@router.get("/", response_model=List[FlowOut])
def list_flows():
    with get_connection() as conn:
        cur = conn.execute(
            "SELECT id, name, slug, created_at, updated_at FROM flows ORDER BY created_at DESC"
        )
        rows = [dict(row) for row in cur.fetchall()]
        return rows


@router.post("/", response_model=FlowOut)
def create_flow(payload: FlowCreate):
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
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM flows WHERE id = ?", (flow_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Flow not found")
        conn.commit()
    return {"ok": True}


@router.get("/{flow_id}/state", response_model=FlowStateOut)
def get_flow_state(flow_id: str):
    with get_connection() as conn:
        # validate flow exists
        cur = conn.execute("SELECT 1 FROM flows WHERE id = ?", (flow_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Flow not found")

        cur = conn.execute(
            "SELECT data, updated_at FROM flow_states WHERE flow_id = ?",
            (flow_id,),
        )
        row = cur.fetchone()
        if not row:
            # Return an empty default state if none saved yet
            return FlowStateOut(flow_id=flow_id, data={"nodes": [], "edges": []}, updated_at=now_iso())
        import json
        return FlowStateOut(flow_id=flow_id, data=json.loads(row["data"]), updated_at=row["updated_at"])


@router.put("/{flow_id}/state", response_model=FlowStateOut)
def upsert_flow_state(flow_id: str, payload: FlowStateIn):
    with get_connection() as conn:
        # validate flow exists
        cur = conn.execute("SELECT 1 FROM flows WHERE id = ?", (flow_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Flow not found")

        import json
        updated_at = now_iso()
        data_json = json.dumps(payload.data)

        # upsert pattern
        cur = conn.execute(
            "SELECT 1 FROM flow_states WHERE flow_id = ?",
            (flow_id,),
        )
        if cur.fetchone():
            conn.execute(
                "UPDATE flow_states SET data = ?, updated_at = ? WHERE flow_id = ?",
                (data_json, updated_at, flow_id),
            )
        else:
            conn.execute(
                "INSERT INTO flow_states (flow_id, data, updated_at) VALUES (?, ?, ?)",
                (flow_id, data_json, updated_at),
            )
        conn.commit()
        return FlowStateOut(flow_id=flow_id, data=payload.data, updated_at=updated_at)


# ---- Schemas (per-flow custom schemas) ----

@router.get("/{flow_id}/schemas", response_model=list[FlowSchemaOut])
def list_flow_schemas(flow_id: str):
    with get_connection() as conn:
        cur = conn.execute("SELECT 1 FROM flows WHERE id = ?", (flow_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Flow not found")
        cur = conn.execute(
            "SELECT id, flow_id, name, description, fields, created_at, updated_at FROM flow_schemas WHERE flow_id = ? ORDER BY created_at DESC",
            (flow_id,),
        )
        import json
        res = []
        for row in cur.fetchall():
            res.append(
                FlowSchemaOut(
                    id=row["id"],
                    flow_id=row["flow_id"],
                    name=row["name"],
                    description=row["description"],
                    fields=json.loads(row["fields"]),
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )
            )
        return res


@router.post("/{flow_id}/schemas", response_model=FlowSchemaOut)
def create_flow_schema(flow_id: str, payload: FlowSchemaIn):
    with get_connection() as conn:
        cur = conn.execute("SELECT 1 FROM flows WHERE id = ?", (flow_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Flow not found")
        import json
        schema_id = new_id()
        now = now_iso()
        conn.execute(
            "INSERT INTO flow_schemas (id, flow_id, name, description, fields, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (schema_id, flow_id, payload.name, payload.description, json.dumps([f.dict() for f in payload.fields]), now, now),
        )
        conn.commit()
        return FlowSchemaOut(
            id=schema_id,
            flow_id=flow_id,
            name=payload.name,
            description=payload.description,
            fields=[f.dict() for f in payload.fields],
            created_at=now,
            updated_at=now,
        )


@router.get("/{flow_id}/schemas/{schema_id}", response_model=FlowSchemaOut)
def get_flow_schema(flow_id: str, schema_id: str):
    with get_connection() as conn:
        cur = conn.execute("SELECT 1 FROM flows WHERE id = ?", (flow_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Flow not found")
        cur = conn.execute(
            "SELECT id, flow_id, name, description, fields, created_at, updated_at FROM flow_schemas WHERE id = ? AND flow_id = ?",
            (schema_id, flow_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Schema not found")
        import json
        return FlowSchemaOut(
            id=row["id"],
            flow_id=row["flow_id"],
            name=row["name"],
            description=row["description"],
            fields=json.loads(row["fields"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


@router.put("/{flow_id}/schemas/{schema_id}", response_model=FlowSchemaOut)
def update_flow_schema(flow_id: str, schema_id: str, payload: FlowSchemaIn):
    with get_connection() as conn:
        cur = conn.execute("SELECT 1 FROM flows WHERE id = ?", (flow_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Flow not found")
        import json
        now = now_iso()
        cur = conn.execute(
            "UPDATE flow_schemas SET name = ?, description = ?, fields = ?, updated_at = ? WHERE id = ? AND flow_id = ?",
            (payload.name, payload.description, json.dumps([f.dict() for f in payload.fields]), now, schema_id, flow_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Schema not found")
        conn.commit()
        return FlowSchemaOut(
            id=schema_id,
            flow_id=flow_id,
            name=payload.name,
            description=payload.description,
            fields=[f.dict() for f in payload.fields],
            created_at=now,
            updated_at=now,
        )


@router.delete("/{flow_id}/schemas/{schema_id}")
def delete_flow_schema(flow_id: str, schema_id: str):
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM flow_schemas WHERE id = ? AND flow_id = ?", (schema_id, flow_id))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Schema not found")
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


# ---- Execution ----

@router.post("/{flow_id}/run/node", response_model=NodeRunOut)
def run_node(flow_id: str, payload: NodeRunIn):
    with get_connection() as conn:
        cur = conn.execute("SELECT 1 FROM flows WHERE id = ?", (flow_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Flow not found")

    import subprocess
    import sys
    import json as _json
    # Pass current environment (dotenv has already loaded on startup)
    import os
    provider_env = dict(os.environ)

    try:
        proc = subprocess.run(
            [sys.executable, "-m", "app.node_runner"],
            input=_json.dumps(payload.dict()).encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=__import__('pathlib').Path(__file__).resolve().parents[1],
            env=provider_env,
            timeout=120,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Runner failed to start: {e}")

    if proc.returncode != 0:
        try:
            data = _json.loads(proc.stdout.decode("utf-8") or "{}")
            return NodeRunOut(**data)
        except Exception:
            raise HTTPException(status_code=500, detail=proc.stderr.decode("utf-8") or "Runner error")

    try:
        data = _json.loads(proc.stdout.decode("utf-8") or "{}")
        return NodeRunOut(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid runner output: {e}")


@router.post("/{flow_id}/run/node/stream")
async def run_node_stream(flow_id: str, request: Request):
    """
    Execute a node and stream structured JSON events (one per line) as the run progresses.

    This streams the stdout of a subprocess running `app.node_runner_stream` which emits
    JSON lines using a DSPy callback and tool wrappers.
    """
    with get_connection() as conn:
        cur = conn.execute("SELECT 1 FROM flows WHERE id = ?", (flow_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Flow not found")

    # Read raw JSON body (pass through to runner)
    try:
        payload_bytes = await request.body()
        # lightweight validation: ensure it is JSON
        _ = __import__("json").loads(payload_bytes.decode("utf-8") or "{}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {e}")

    import asyncio
    import subprocess
    import sys
    import os as _os
    from pathlib import Path

    provider_env = dict(_os.environ)
    workdir = Path(__file__).resolve().parents[1]

    # Start subprocess with pipes
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-m",
            "app.node_runner_stream",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(workdir),
            env=provider_env,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Runner failed to start: {e}")

    # Send payload
    assert proc.stdin is not None
    proc.stdin.write(payload_bytes)
    await proc.stdin.drain()
    proc.stdin.close()

    async def event_stream() -> AsyncGenerator[bytes, None]:
        assert proc.stdout is not None
        # Stream stdout lines immediately as they arrive
        try:
            while True:
                line = await proc.stdout.readline()
                if not line:
                    break
                # Each line is a JSON object (utf-8)
                yield line
        except __import__("asyncio").CancelledError:
            # Client disconnected; terminate the child process
            try:
                if proc.returncode is None:
                    proc.kill()
            except Exception:
                pass
            raise
        finally:
            # Ensure process exits
            try:
                await proc.wait()
            except Exception:
                pass

    # application/x-ndjson is convenient for line-delimited JSON
    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
