# Python backend for DSPY Builder

Run with uv (recommended):

- Install deps: `uv sync`
- Start dev server: `uv run uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000`

API base URL: `http://localhost:8000/api`

Environment/ports:
- Frontend dev: `http://localhost:3000`
- Backend dev: `http://localhost:8000`

Notes:
- Uses SQLite at `backend/data/flows.db` (created on first run)
- CORS is enabled for `http://localhost:3000`
