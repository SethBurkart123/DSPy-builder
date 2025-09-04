"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import type { TypedNodeData, PortType } from "@/components/flowbuilder/types";
import { Lock } from "lucide-react";
import { handleStyleForPort, HANDLE_SIZE, NODE_GRID_PADDING_X, genId } from "@/lib/flow-utils";

type DragState = {
  isDragging: boolean;
  portType: PortType | null;
  sourceNodeId: string | null;
  handleId: string | null;
} | null;

export function PortListSection({
  nodeId,
  data,
  role,
  autogrow,
  accepts,
  portSpacing = 32,
  isDragHovering = false,
}: {
  nodeId: string;
  data: TypedNodeData;
  role: "inputs" | "outputs";
  autogrow?: boolean;
  accepts?: PortType[];
  portSpacing?: number;
  isDragHovering?: boolean;
}) {
  const [dragState, setDragState] = useState<DragState>(null);
  
  // Generate a stable dropzone ID per node that persists until used
  const [dropzoneId, setDropzoneId] = useState(() => genId('p'));

  useEffect(() => {
    function handleDragStateChange(event: any) {
      setDragState(event.detail);
    }
    window.addEventListener("drag-state-change", handleDragStateChange);
    return () => window.removeEventListener("drag-state-change", handleDragStateChange);
  }, []);

  const ports = useMemo(() => {
    if (role === "inputs") {
      return (data.inputs || []).filter((p) => !(p.type === "llm" && p.name === "model"));
    }
    return data.outputs || [];
  }, [data.inputs, data.outputs, role]);

  const showDropZone = useMemo(() => {
    if (!autogrow) return false;
    if (data.kind === "input") return false; // don't add inputs to input node
    const typeOk = dragState?.portType ? (!accepts || accepts.includes(dragState.portType)) : false;
    return !!(dragState?.isDragging && isDragHovering && typeOk && dragState.sourceNodeId !== nodeId && role === "inputs");
  }, [autogrow, data.kind, dragState, isDragHovering, nodeId, role, accepts]);

  const handleDropZoneClick = useCallback(() => {
    if (dragState?.isDragging && dragState.portType && dragState.sourceNodeId && dragState.handleId) {
      const eventDetail = {
        targetNodeId: nodeId,
        portType: dragState.portType,
        sourceNodeId: dragState.sourceNodeId,
        sourceHandleId: dragState.handleId,
        dropzoneId: dropzoneId,
      };
      const event = new CustomEvent("add-input-port", { detail: eventDetail });
      window.dispatchEvent(event);

      setDropzoneId(genId("p"));
    }
  }, [nodeId, dragState, dropzoneId]);

  function formatValue(v: any): string {
    try {
      if (typeof v === "string") return v;
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  return (
    <div className={role === "inputs" ? "flex flex-col justify-start min-w-0 relative" : "text-right flex flex-col justify-start min-w-0 relative"}>
      <div>
        {role === "inputs"
          ? ports.map((p) => (
              <div key={p.id} className="flex items-center relative" style={{ height: `${portSpacing}px` }}>
                {/* Input handle on left, aligned to row center */}
                <Handle
                  id={`in-${p.id}`}
                  type="target"
                  position={Position.Left}
                  className={`border !border-border absolute`}
                  style={{
                    ...handleStyleForPort(p.type),
                    left: -((HANDLE_SIZE / 2) + NODE_GRID_PADDING_X),
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
                <div className="text-xs min-w-0 flex-1">
                  <div className={`truncate flex items-center gap-1 ${p.locked ? "text-amber-700 font-medium" : ""}`}>
                    {p.locked && <Lock className="h-3 w-3 text-amber-600" />}
                    {p.name}
                    {p.type === "object" && p.customSchema && (
                      <span className="text-gray-500 ml-1">({p.customSchema.name})</span>
                    )}
                  </div>
                  {p.description && (
                    <div className="text-gray-500 text-[10px] leading-tight mt-1 truncate">{p.description}</div>
                  )}
                </div>
              </div>
            ))
          : ports.map((p) => (
              <div key={p.id} className="flex items-center justify-end gap-2 relative" style={{ height: `${portSpacing}px` }}>
                {/* Output handle on right, aligned to row center */}
                <Handle
                  id={`out-${p.id}`}
                  type="source"
                  position={Position.Right}
                  className={`border !border-border absolute`}
                  style={{
                    ...handleStyleForPort(p.type),
                    right: -((HANDLE_SIZE / 2) + NODE_GRID_PADDING_X),
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
                <div className="text-xs text-right min-w-0 flex-1">
                  <div className={`truncate flex items-center justify-end gap-1 ${p.locked ? "opacity-90 font-medium" : ""}`}>
                    {p.name}
                    {p.type === "object" && p.customSchema && (
                      <span className="text-gray-500 ml-1">({p.customSchema.name})</span>
                    )}
                    {p.locked && <Lock className="h-3 w-3" />}
                  </div>
                  {(() => {
                    // For input nodes, show configured value if present, else description
                    if (data.kind === 'input') {
                      const v = data.values?.[p.name];
                      const txt = v !== undefined ? formatValue(v) : p.description;
                      return txt ? (
                        <div className="text-gray-500 text-[10px] leading-tight mt-1 truncate">{txt}</div>
                      ) : null;
                    }

                    // show the description
                    return p.description ? (
                      <div className="text-gray-500 text-[10px] leading-tight mt-1 truncate">{p.description}</div>
                    ) : null;
                  })()}
                </div>
              </div>
            ))}

        {showDropZone && dragState?.portType && dragState?.portType !== "llm" && role === "inputs" && (
          <div className="flex items-center text-[10px] w-full relative" style={{ height: `${portSpacing}px` }}>
            <Handle
              id={`in-${dropzoneId}`}
              type="target"
              position={Position.Left}
              onMouseUp={() => handleDropZoneClick()}
              className={`border !border-border absolute`}
              style={{
                ...handleStyleForPort(dragState.portType),
                left: -((HANDLE_SIZE / 2) + NODE_GRID_PADDING_X),
              }}
            />
            <span className="italic opacity-80">{dragState.portType}</span>
          </div>
        )}
      </div>
    </div>
  );
}
