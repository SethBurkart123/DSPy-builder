DSPY Builder Architecture

This document provides a detailed visual of the end‑to‑end architecture and key data flows.

Architecture Overview

```mermaid
flowchart LR
  %% Layout
  classDef faded fill:#f6f7f9,stroke:#d0d7de,color:#57606a
  classDef store fill:#fff4ce,stroke:#d4a72c,color:#653c0c
  classDef svc fill:#eef6ff,stroke:#54aeff,color:#0969da
  classDef module fill:#f1f8e9,stroke:#7bc96f,color:#1a7f37
  classDef accent fill:#fff,stroke:#444,color:#111

  subgraph FE[Frontend (Next.js / React)]
    FB["FlowBuilder UI\n`app/flow/[id]/page.tsx`"]:::accent
    RF[@xyflow/react\nReactFlow Graph]:::faded
    NI[NodeInspector\n`components/flowbuilder/NodeInspector.tsx`]:::faded
    FP[FlowTracePanel\n`components/flowbuilder/FlowTracePanel.tsx`]:::faded
    PL[Palette\n`components/flowbuilder/Palette.tsx`]:::faded
    TYPES[Node Types / Registry\n`lib/node-def.ts`]:::faded
    API[API Client\n`lib/api.ts`]:::svc
  end

  subgraph BE[Backend (FastAPI / Python)]
    APP[FastAPI App\n`backend/main.py`]:::svc
    FLOWS[Flows Router\n`backend/routes/flows.py`]:::svc
    KEYS[Keys Router\n`backend/routes/keys.py`]:::svc
    DB[(SQLite DB\n`backend/data/flows.db`\n`backend/app/db.py`)]:::store

    subgraph RUN[Execution]
      RUN1[node_runner (one‑shot)\n`backend/app/node_runner.py`]:::module
      RUNS[node_runner_stream (stream)\n`backend/app/node_runner_stream.py`]:::module
      CORE[Runner Core\n`backend/app/runner_core.py`]:::module
      SIG[Signature Builder\n`backend/app/dspy_signature.py`]:::module
      SCB[Streaming Callback\n`backend/app/dspy_streaming.py`]:::module
    end
  end

  subgraph EXT[External]
    DSPY[dspy library]:::faded
    LLM[Model Providers\nOpenAI/Anthropic/Gemini/Groq/…]:::faded
    ENV[Provider Keys\n`backend/.env.local`]:::store
  end

  %% FE internal wiring
  FB --> RF
  FB --> NI
  FB --> PL
  FB --> TYPES
  FB --> API
  FP <--> FB

  %% FE -> BE
  API --> APP
  APP --> FLOWS
  APP --> KEYS
  FLOWS <--> DB

  %% Execution path
  FLOWS -->|POST /flows/{id}/run/node| RUN1
  FLOWS -->|POST /flows/{id}/run/node/stream| RUNS
  RUN1 --> CORE
  RUNS --> CORE
  CORE --> SIG
  CORE --> DSPY
  DSPY -.configure.-> SCB
  SCB -.emit NDJSON.-> RUNS
  DSPY -->|LM(model=…) calls| LLM

  %% Keys
  KEYS -->|write/read| ENV
  ENV -->|loaded on startup| APP
  ENV -->|used by dspy.LM| DSPY

  %% Save/Load state, schemas, previews
  FB -->|save state| API --> FLOWS
  FLOWS -->|upsert/get state/schemas/previews| DB

  %% Streaming return
  RUNS -->|stdout NDJSON| FLOWS -->|stream response| API -->|update runtime + trace| FP

  %% Tools from tool nodes
  FB -->|tools_code from Tool nodes| API --> FLOWS --> RUNS
  CORE -.parse+wrap tools.-> CORE
```

Run (Streaming) Sequence

```mermaid
sequenceDiagram
  participant UI as FlowBuilder UI
  participant API as lib/api.ts
  participant FX as FastAPI / flows.py
  participant RS as node_runner_stream.py
  participant RC as runner_core.py
  participant DSP as dspy
  participant LLM as Provider API

  UI->>API: POST /flows/{id}/run/node/stream
  API->>FX: node kind/title, schemas, inputs, model, tools_code
  FX->>RS: spawn subprocess; write JSON to stdin
  RS->>RC: build Signature + module, wrap tools
  RC->>DSP: settings.configure(lm=LM(...), callbacks=[StreamingCallback])
  DSP-->>RS: emit lm/tool/module events via callback
  RS-->>FX: write NDJSON lines to stdout
  FX-->>API: stream NDJSON (application/x-ndjson)
  API-->>UI: append events to node.runtime + FlowTracePanel
  DSP->>LLM: model calls using env keys
  LLM-->>DSP: responses
```

Notes

- Frontend saves graph state (`nodes`/`edges`) to the backend; backend persists in SQLite (`flow_states`).
- Custom Schemas are CRUD‑ed under a flow and stored as JSON (`flow_schemas`).
- Import/Export bundles include flow metadata, state, and schemas.
- Keys Router manages provider API keys in `backend/.env.local`; `dspy.LM` reads from process env.
- One‑shot and streaming execution both route through the Runner Core; streaming adds structured events for the UI.

