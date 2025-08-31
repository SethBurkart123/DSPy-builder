"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { PORT_COLORS, PORT_HEX, type TypedNodeData, type PortType } from "./types";

const HANDLE_SIZE = 14; // px

function handleStylesFor(type: PortType): { className: string; style: React.CSSProperties } {
  const baseStyle: React.CSSProperties = {
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
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
    case "object":
      return {
        className: `${PORT_COLORS[type]}`,
        style: { ...baseStyle, borderRadius: 2 },
      };
    case "array":
      return {
        className: `${PORT_COLORS[type]}`,
        style: {
          ...baseStyle,
          clipPath: "polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%)",
        },
      };
    default:
      return { className: `${PORT_COLORS.string}`, style: { ...baseStyle, borderRadius: HANDLE_SIZE } };
  }
}

function TypedNodeComponent({ data, selected, id }: NodeProps<TypedNodeData>) {
  // Calculate minimum height needed for all ports
  const maxPorts = Math.max(data.inputs?.length || 0, data.outputs?.length || 0);
  const headerHeight = 41; // Header is py-2 (8px top+bottom) + text height (~25px) + border = ~41px
  const portSpacing = 32;
  const contentPaddingTop = 12; // p-3 = 12px padding
  const baseContentPadding = 24; // padding top + bottom
  const minContentHeight = maxPorts * portSpacing;
  const minTotalHeight = headerHeight + minContentHeight + baseContentPadding;

  return (
    <div 
      className={`min-w-[220px] rounded-lg border bg-card text-card-foreground shadow ${selected ? "ring-2 ring-primary" : ""} relative flex flex-col`}
      style={{ minHeight: `${minTotalHeight}px` }}
    >
      {/* Input handles positioned at left edge */}
      {data.inputs?.map((p, index) => {
        const s = handleStylesFor(p.type);
        const handleTop = headerHeight + contentPaddingTop + (index * portSpacing) + (portSpacing / 2); // center in each port row
        return (
          <Handle
            key={`in-${p.id}`}
            id={`in-${p.id}`}
            type="target"
            position={Position.Left}
            className={`border !border-border ${s.className} absolute`}
            style={{
              ...s.style,
              left: -HANDLE_SIZE / 2,
              top: handleTop,
            }}
          />
        );
      })}

      {/* Output handles positioned at right edge */}
      {data.outputs?.map((p, index) => {
        const s = handleStylesFor(p.type);
        const handleTop = headerHeight + contentPaddingTop + (index * portSpacing) + (portSpacing / 2); // center in each port row
        return (
          <Handle
            key={`out-${p.id}`}
            id={`out-${p.id}`}
            type="source"
            position={Position.Right}
            className={`border !border-border ${s.className} absolute`}
            style={{
              ...s.style,
              right: -HANDLE_SIZE / 2,
              top: handleTop,
            }}
          />
        );
      })}

      <div className="flex items-center justify-between rounded-t-lg border-b bg-muted/50 px-3 py-2 pb-[14px]">
        <div className="text-xs font-semibold">{data.title}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-3 flex-1">
        <div className="flex flex-col justify-start">
          <div>
            {data.inputs?.map((p, index) => (
              <div 
                key={p.id} 
                className="flex items-center gap-2"
                style={{ height: `${portSpacing}px` }}
              >
                <div className="truncate text-xs">
                  {p.name}
                  {p.type === "object" && p.customSchema && (
                    <span className="text-gray-500 ml-1">({p.customSchema.name})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-right flex flex-col justify-start">
          <div>
            {data.outputs?.map((p, index) => (
              <div 
                key={p.id} 
                className="flex items-center justify-end gap-2"
                style={{ height: `${portSpacing}px` }}
              >
                <div className="truncate text-xs">
                  {p.name}
                  {p.type === "object" && p.customSchema && (
                    <span className="text-gray-500 ml-1">({p.customSchema.name})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const TypedNode = memo(TypedNodeComponent);
