"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Lock, Plus } from "lucide-react";
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

// Add a type for drag state that can be passed as a prop
export type DragState = {
  isDragging: boolean;
  portType: PortType | null;
  sourceNodeId: string | null;
  handleId: string | null;
} | null;

function TypedNodeComponent({ data, selected, id }: NodeProps<TypedNodeData>) {
  const [isDragHovering, setIsDragHovering] = useState(false);
  const [dragState, setDragState] = useState<DragState>(null);

  // Listen for drag state changes from the main flow component
  useEffect(() => {
    function handleDragStateChange(event: any) {
      setDragState(event.detail);
    }

    window.addEventListener('drag-state-change', handleDragStateChange);
    return () => window.removeEventListener('drag-state-change', handleDragStateChange);
  }, []);

  // Calculate minimum height needed for all ports
  const maxPorts = Math.max(data.inputs?.length || 0, data.outputs?.length || 0);
  const headerHeight = 41; // Header is py-2 (8px top+bottom) + text height (~25px) + border = ~41px
  const portSpacing = 32;
  const contentPaddingTop = 12; // p-3 = 12px padding
  const baseContentPadding = 24; // padding top + bottom
  const minContentHeight = maxPorts * portSpacing;
  const dropZoneHeight = 28; // Height for the drop zone
  const showDropZone = dragState?.isDragging && isDragHovering && dragState.portType && dragState.sourceNodeId !== id;
  const minTotalHeight = headerHeight + minContentHeight + baseContentPadding + (showDropZone ? dropZoneHeight : 0);

  const handleMouseEnter = useCallback(() => {
    if (dragState?.isDragging && dragState.portType && dragState.sourceNodeId !== id) {
      setIsDragHovering(true);
    }
  }, [dragState, id]);

  const handleMouseLeave = useCallback(() => {
    setIsDragHovering(false);
  }, []);

  const handleDropZoneClick = useCallback(() => {
    if (dragState?.isDragging && dragState.portType && dragState.sourceNodeId && dragState.handleId) {
      // Trigger the add input port functionality
      const eventDetail = {
        targetNodeId: id,
        portType: dragState.portType,
        sourceNodeId: dragState.sourceNodeId,
        sourceHandleId: dragState.handleId
      };
      
      const event = new CustomEvent('add-input-port', {
        detail: eventDetail
      });
      window.dispatchEvent(event);
    }
  }, [id, dragState]);

  return (
    <div 
      className={`w-[240px] rounded-lg border bg-card text-card-foreground shadow ${selected ? "ring-2 ring-primary" : ""} relative flex flex-col`}
      style={{ minHeight: `${minTotalHeight}px` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
        <div className="text-xs font-semibold truncate">{data.title}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-3 flex-1">
        <div className="flex flex-col justify-start min-w-0">
          <div>
            {data.inputs?.map((p, index) => (
              <div 
                key={p.id} 
                className="flex items-center gap-2"
                style={{ height: `${portSpacing}px` }}
              >
                <div className="text-xs min-w-0 flex-1">
                  <div className={`truncate flex items-center gap-1 ${p.locked ? 'text-amber-700 font-medium' : ''}`}>
                    {p.locked && <Lock className="h-3 w-3 text-amber-600" />}
                    {p.name}
                    {p.type === "object" && p.customSchema && (
                      <span className="text-gray-500 ml-1">({p.customSchema.name})</span>
                    )}
                  </div>
                  {p.description && (
                    <div className="text-gray-500 text-[10px] leading-tight mt-1 truncate">
                      {p.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-right flex flex-col justify-start min-w-0">
          <div>
            {data.outputs?.map((p, index) => (
              <div 
                key={p.id} 
                className="flex items-center justify-end gap-2"
                style={{ height: `${portSpacing}px` }}
              >
                <div className="text-xs text-right min-w-0 flex-1">
                  <div className={`truncate flex items-center justify-end gap-1 ${p.locked ? 'opacity-90 font-medium' : ''}`}>
                    {p.name}
                    {p.type === "object" && p.customSchema && (
                      <span className="text-gray-500 ml-1">({p.customSchema.name})</span>
                    )}
                    {p.locked && <Lock className="h-3 w-3" />}
                  </div>
                  {p.description && (
                    <div className="text-gray-500 text-[10px] leading-tight mt-1 truncate">
                      {p.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {showDropZone && dragState?.portType && (
          <div 
            className="flex text-xs w-full relative"
            onMouseUp={handleDropZoneClick}
          >
            <Handle
              type="target"
              position={Position.Left}
              className={`border !border-border absolute -ml-3 mt-1.5`}
              style={{
                ...handleStylesFor(dragState.portType).style,
                left: -HANDLE_SIZE / 2,
                top: 0,
              }}  
            />
            <span className="italic opacity-80">{dragState.portType.charAt(0).toUpperCase() + dragState.portType.slice(1)}</span>
          </div>
        )}

      </div>
    </div>
  );
}

export const TypedNode = memo(TypedNodeComponent);
