"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { PORT_COLORS, PORT_HEX, type TypedNodeData, type PortType } from "./types";

const HANDLE_SIZE = 14; // px

function handleStylesFor(
  type: PortType,
  side: "left" | "right"
): { className: string; style: React.CSSProperties } {
  const baseStyle: React.CSSProperties = {
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    ...(side === "left" ? { marginLeft: -16 } : { marginRight: -16 }),
    backgroundColor: PORT_HEX[type],
  };

  switch (type) {
    case "string":
      return { className: `${PORT_COLORS[type]}`, style: { ...baseStyle, borderRadius: HANDLE_SIZE } };
    case "string[]":
      return { className: `${PORT_COLORS[type]}`, style: { ...baseStyle, borderRadius: 2 } }; // square
    case "boolean":
      // diamond via clip-path (avoid transform which would break positioning)
      return {
        className: `${PORT_COLORS[type]}`,
        style: { ...baseStyle, clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" },
      };
    case "float":
      return {
        className: `${PORT_COLORS[type]}`,
        style: {
          ...baseStyle,
          clipPath: "polygon(12% 50%, 28% 8%, 72% 8%, 88% 50%, 72% 92%, 28% 92%)",
        },
      };
    case "int":
      return {
        className: `${PORT_COLORS[type]}`,
        style: { ...baseStyle, clipPath: "polygon(50% 0, 0 100%, 100% 100%)" },
      };
    default:
      return { className: `${PORT_COLORS.string}`, style: { ...baseStyle, borderRadius: HANDLE_SIZE } };
  }
}

function TypedNodeComponent({ data, selected, id }: NodeProps<TypedNodeData>) {
  return (
    <div className={`min-w-[220px] rounded-lg border bg-card text-card-foreground shadow ${selected ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-center justify-between rounded-t-lg border-b bg-muted/50 px-3 py-2">
        <div className="text-xs font-semibold">{data.title}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-3">
        <div>
          <div className="space-y-2">
            {data.inputs?.map((p) => {
              const s = handleStylesFor(p.type, "left");
              return (
                <div key={p.id} className="relative flex items-center gap-2">
                  <Handle
                    id={`in-${p.id}`}
                    type="target"
                    position={Position.Left}
                    className={`border !border-border ${s.className}`}
                    style={s.style}
                  />
                  <div className="truncate text-xs">{p.name}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="text-right">
          <div className="space-y-2">
            {data.outputs?.map((p) => {
              const s = handleStylesFor(p.type, "right");
              return (
                <div key={p.id} className="relative flex items-center justify-end gap-2">
                  <div className="truncate text-xs">{p.name}</div>
                  <Handle
                    id={`out-${p.id}`}
                    type="source"
                    position={Position.Right}
                    className={`border !border-border ${s.className}`}
                    style={s.style}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export const TypedNode = memo(TypedNodeComponent);
