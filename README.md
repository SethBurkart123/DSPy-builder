DSPY Builder is a full‑stack app for visually building, running, and inspecting DSPy workflows. Create nodes (Predict, Chain‑of‑Thought, Agent), wire ports with types, attach tools, define custom schemas, and stream live traces of LLM/tool execution.

See docs/architecture.md for a deep dive into how everything fits together.

## Features

- Visual flow editor with typed ports (string, boolean, int, float, array, object, literal, llm, tool)
- Built‑in node kinds: Input, Output, LLM Provider, Predict, Chain‑of‑Thought, Agent (ReAct), Tool nodes (Wikipedia/Math/Custom Python)
- One‑click run of a single node or an entire flow, with automatic upstream execution
- Streaming trace panel showing LM prompts/responses, tool calls, and reasoning
- Custom schema library with import/export, per‑flow persistence
- API key manager that writes provider keys to the backend
- Import/Export flows as portable .flow.json bundles

## Tech Stack

- Frontend: Next.js (App Router), React, @xyflow/react (React Flow), Tailwind CSS, Radix UI
- Backend: FastAPI, SQLite, Pydantic, DSPy

## Prerequisites

- Node.js 18+ and pnpm (recommended)
- Python 3.11+
- Optional but recommended: uv (https://docs.astral.sh/uv/) for Python dependency management

## Setup

1) Backend (FastAPI)

Option A: using uv

```
cd backend
uv sync
uv run uvicorn backend.main:app --reload --port 8000
```

Option B: using pip

```
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install fastapi uvicorn[standard] pydantic dspy python-dotenv
uvicorn backend.main:app --reload --port 8000
```

2) Frontend (Next.js)

```
pnpm install
pnpm dev
```

Open http://localhost:3000 to use the app.

## Configuration

- Frontend → Backend URL: set `NEXT_PUBLIC_API_URL` in root `.env.local` (defaults to `http://localhost:8000`). Example:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- Provider API Keys: set in `backend/.env.local` or use the in‑app “API Keys” dialog (Topbar → API Keys). Known env vars include `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`/`GEMINI_API_KEY`, `GROQ_API_KEY`, `COHERE_API_KEY`, `MISTRAL_API_KEY`, `TOGETHER_API_KEY`, `PERPLEXITY_API_KEY`, `FIREWORKS_API_KEY`.

The backend auto‑loads `backend/.env.local` and `backend/.env` on startup.

## Data Storage

- SQLite database at `backend/data/flows.db` is created automatically and stores flows, saved graph state, schemas, and optional preview images.

## Using the App

- Dashboard (create/open/delete flows): `app/page.tsx`
- Open a flow to access the visual builder. Add nodes from the palette, connect ports, and set per‑node LLM defaults. The “Run” button on nodes runs upstream dependencies first; “Run All” executes compute nodes across the graph.
- The Trace panel shows live events while running (LM prompts/responses, tools, module boundaries) and aggregates final outputs.
- Use Schema Library to create/select reusable object schemas for ports.
- Export a flow (Topbar → Export) to a `.flow.json`. Import on the dashboard.

## Scripts

- `pnpm dev`: start Next.js in dev mode
- `pnpm build`: build the frontend
- `pnpm start`: start the built frontend

## API Overview

All endpoints are under `${NEXT_PUBLIC_API_URL}/api` (default `http://localhost:8000/api`). See `lib/api.ts` for client usage:

- Flows: list/create/get/rename/delete; get/save state; export/import
- Schemas (per‑flow): list/create/get/update/delete
- Keys: list/upsert/delete
- Execute node: `POST /flows/{id}/run/node` (one‑shot) and `POST /flows/{id}/run/node/stream` (line‑delimited JSON events)

For implementation details and payload shapes, see docs/architecture.md.

## Troubleshooting

- 404 from frontend: ensure `NEXT_PUBLIC_API_URL` points to the running backend
- DSPy model auth errors: set the corresponding `*_API_KEY` via API Keys dialog or in `backend/.env.local`
- Preview capture: requires `html-to-image` (included). If capture fails, ensure the canvas is visible.

## License

Proprietary