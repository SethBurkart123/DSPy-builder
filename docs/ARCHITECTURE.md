# DSPy Studio Flow Architecture

This document explains how the flow editor is structured, how nodes are defined declaratively, and how to extend it safely without scattering logic.

## Overview

The UI is built from small, declarative “sections” that are stacked to form a node. Each node kind declares its sections in a central registry; the node renderer reads that registry and renders sections. All handle visuals, edge colors, and titles are centralized so behavior is consistent across the app.

Key files:
- `lib/node-def.ts:1` — Node/Section/Control spec registry
- `components/flowbuilder/TypedNode.tsx:1` — renders sections for a node instance
- `components/flowbuilder/sections/ports/PortListSection.tsx:1` — inputs/outputs lists + handles + autogrow
- `components/flowbuilder/sections/controls/ControlGroupSection.tsx:1` — configurable controls (text/number/select/slider) with optional binding to input ports
- `lib/flow-utils.ts:1` — titles, edge styling, and shared handle visuals/constants
- `app/flow/[id]/page.tsx:1` — flow container: node/edge state, connect behavior, spawn/autogrow wiring, persistence

## Data Model

- `PortType` (in `components/flowbuilder/types.ts:1`): "string" | "string[]" | "boolean" | "float" | "int" | "object" | "array" | "llm".
- `NodeKind` (same file): "chainofthought" | "predict" | "input" | "output" | "llm".
- `TypedNodeData` includes:
  - `inputs`, `outputs`: arrays of typed ports
  - `llm` (optional): provider settings
  - `connected.inputsById`, `connected.inputsByName`: derived connectivity maps (kept in sync from edges)
  - `runtime` (optional): ephemeral status and outputs

## Declarative Node Registry

Node kinds are declared in `lib/node-def.ts:1` as a map of `NodeKind -> NodeDefinition`.

Section types:
- `port_list` — renders a list of ports and their row handles
  - `role`: "inputs" | "outputs"
  - `autogrow?`: show a drop-zone to add an input when dragging a compatible edge
  - `accepts?`: `PortType[]` restricting autogrow drops
  - `colSpan?`: `1 | 2` (grid columns to span)
- `control_group` — renders form controls bound into node data
  - `controls`: array of `ControlSpec`
  - `inline?`, `colSpan?`, `selectable?`
- `empty_spacer` — grid spacer with optional `colSpan`

ControlSpec fields:
- `id`, `label?`, `type`: "text" | "number" | "select" | "slider"
- `dataPath`: dot path into node data (shallow: e.g. `llm.model`, `llm.temperature`)
- Numeric options: `min?`, `max?`, `step?`
- Select options: `options?: { label?, value }[]`
- Optional binding: `bind` → inline control can bind to an input port
  - `inputPortName`: e.g., "model"
  - `portType?`: e.g., "llm"
  - `hideWhenBound?`: hide control when connected
  - `boundFlagPath?`: boolean path (e.g., `connected.inputsByName.model`)

Example (predict model inline control):
- Control hides when `connected.inputsByName.model` is true and shows a subtle bound chip.

## Section Renderers

### PortListSection (`components/flowbuilder/sections/ports/PortListSection.tsx:1`)
- Renders a two-column row list: names/descriptions and per-row handle.
- Input rows: left target handles (`id = in-<portId>`).
- Output rows: right source handles (`id = out-<portId>`).
- Autogrow drop-zone (inputs only):
  - Shown when dragging and the dragged type is accepted (`accepts`), and the source is another node.
  - Emits `add-input-port` CustomEvent with `{ targetNodeId, portType, sourceNodeId, sourceHandleId }`.
- Output subheadings:
  - For `predict`/`chainofthought`: always show the port description.
  - For `input`: show configured value if present, else description.
  - For other nodes: show runtime preview if present, else description.

### ControlGroupSection (`components/flowbuilder/sections/controls/ControlGroupSection.tsx:1`)
- Renders controls bound via `dataPath`.
- `text`, `number`, `select`, `slider` are supported.
- Optional binding:
  - If `bind` is defined and the matching input is wired, a left target handle is rendered and the control can be hidden (`hideWhenBound`) with a subtle bound chip.
- Emits `update-node-data` CustomEvent with `{ nodeId, patch }`.

## Node Renderer

`components/flowbuilder/TypedNode.tsx:1`:
- Reads the node definition from `NodeRegistry` and renders sections in order inside a `grid grid-cols-2` container.
- Applies each section’s `colSpan`.
- Node height is computed from header and the greater of inputs/outputs counts; sections render their own handles.

## Centralized Styles and Behavior

`lib/flow-utils.ts:1` provides:
- `getNodeTitle(kind)` → label for Palette / titles
- `edgeStyleForType(portType)` → color + width; LLM = neutral gray
- `portTypeForHandle(node, handleId)` → find port type by handle id
- Handle visuals:
  - `handleStyleForPort(portType)` → shape + color
  - Constants: `HANDLE_SIZE`, `NODE_GRID_PADDING_X`, `NODE_WIDTH`, `HEADER_HEIGHT`, `PORT_ROW_HEIGHT`

All sections import and use these values; connection preview line (`CustomConnectionLine`) also uses `edgeStyleForType` so previews match final edges.

## Flow Container

`app/flow/[id]/page.tsx:1` owns graph state and IO:
- Spawn nodes via Palette or reverse-drag: uses `getNodeTitle` for labels
- Connect edges: uses `edgeStyleForType` for styling
- Drag-to-autogrow: listens for `add-input-port` to add an input and auto-connect
- Derived connectivity: computes `connected.inputsById/inputsByName` for each node (used by inline bindings)
- Persistence: debounced save to API

Custom events used:
- `drag-state-change` → nodes show/hide autogrow drop-zones
- `add-input-port` → add an input + connect from dragged source
- `update-node-data` → patch a node’s `data` from sections

## Adding a New Node Type

1. Add a `NodeKind` value in `components/flowbuilder/types.ts:1`.
2. Implement default inputs/outputs in `makeNode` (`app/flow/[id]/page.tsx:1`).
3. Add a `NodeDefinition` in `lib/node-def.ts:1` with your sections (port lists, control groups, spacers).
4. Optionally add to Palette options (`components/flowbuilder/Palette.tsx:1`).

## Adding a New Section Type

1. Extend `SectionConfig` in `lib/node-def.ts:1` with a new discriminated union variant.
2. Implement the renderer in `components/flowbuilder/sections/<kind>/<YourSection>.tsx`.
3. Update `TypedNode.tsx:1` to render the new section kind.
4. Keep all handles inside the section and use `handleStyleForPort`.

## Adding a New Control Type

1. Extend `ControlType` in `lib/node-def.ts:1`.
2. Add rendering and data patch logic in `ControlGroupSection.tsx:1`.
3. Use `dataPath` for storage and `bind` for optional inline binding.

## Best Practices

- Always render handles inside a section; never from the parent node.
- Use `handleStyleForPort` for consistent visuals.
- Prefer `boundFlagPath = connected.inputsByName.<portName>` over ad‑hoc flags.
- Use `accepts` on `port_list` to limit autogrow; consider also gating connects if needed in validation.
- Keep `dataPath` shallow (`a.b`) for predictability; the setter is optimized for 1–2 levels.
- Use `colSpan` to manage section layout; avoid hardcoding widths.

## Limitations / Future Work

- `dataPath` setter supports shallow paths; generalize if deeper nesting is required.
- `accepts` currently gates autogrow; optional: also enforce in connect validation.
- Per‑control layout (`colSpan` per control) can be added if needed.
- Provide a small `lib/events.ts` for event names to remove string literals.

## Example: Adding a Tool-Using Node

1. Extend `NodeKind` with `"tool"`.
2. In `makeNode`, define default I/O ports.
3. In `NodeRegistry`, compose sections:
   - A `control_group` with tool name (select) and arguments (text), `colSpan: 2`.
   - `port_list` for inputs (accepts types your tool can handle).
   - `port_list` for outputs.
4. Controls write to `data.tool.*` and can bind to an input if you want inline override.

That’s it — new nodes are defined declaratively, sections are reusable, and all behavior/visuals are centralized for consistency.
