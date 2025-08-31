"use client";

import { useMemo } from "react";
import type { Node } from "reactflow";
import { type Port, type PortType, type TypedNodeData } from "./types";

const ALL_TYPES: PortType[] = ["string", "string[]", "boolean", "float", "int"];

export default function NodeInspector({
  node,
  onChange,
  onAddPort,
  onRemovePort,
}: {
  node: Node<TypedNodeData> | null;
  onChange: (data: TypedNodeData) => void;
  onAddPort: (direction: "inputs" | "outputs") => void;
  onRemovePort: (direction: "inputs" | "outputs", portId: string) => void;
}) {
  const data = node?.data;
  const hasNode = !!node;
  const title = useMemo(() => data?.title ?? "No selection", [data?.title]);

  if (!hasNode) return null;

  function updatePort(direction: "inputs" | "outputs", idx: number, patch: Partial<Port>) {
    if (!data) return;
    const arr = [...(data[direction] || [])];
    arr[idx] = { ...arr[idx], ...patch };
    onChange({ ...data, [direction]: arr });
  }

  return (
    <div className="fixed right-4 top-16 z-40 w-80 rounded-lg border bg-background p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>

      <div className="mt-4 space-y-6">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-medium uppercase text-muted-foreground">Inputs</h4>
            <button className="text-xs underline" onClick={() => onAddPort("inputs")}>Add</button>
          </div>
          <div className="space-y-3">
            {data?.inputs?.map((p, idx) => (
              <div key={p.id} className="rounded-md border p-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    className="w-40 rounded border px-2 py-1 text-xs"
                    value={p.name}
                    onChange={(e) => updatePort("inputs", idx, { name: e.target.value })}
                  />
                  <select
                    className="rounded border px-2 py-1 text-xs"
                    value={p.type}
                    onChange={(e) => updatePort("inputs", idx, { type: e.target.value as PortType })}
                  >
                    {ALL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button className="text-xs text-red-600" onClick={() => onRemovePort("inputs", p.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-medium uppercase text-muted-foreground">Outputs</h4>
            <button className="text-xs underline" onClick={() => onAddPort("outputs")}>Add</button>
          </div>
          <div className="space-y-3">
            {data?.outputs?.map((p, idx) => (
              <div key={p.id} className="rounded-md border p-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    className="w-40 rounded border px-2 py-1 text-xs"
                    value={p.name}
                    onChange={(e) => updatePort("outputs", idx, { name: e.target.value })}
                  />
                  <select
                    className="rounded border px-2 py-1 text-xs"
                    value={p.type}
                    onChange={(e) => updatePort("outputs", idx, { type: e.target.value as PortType })}
                  >
                    {ALL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button className="text-xs text-red-600" onClick={() => onRemovePort("outputs", p.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

