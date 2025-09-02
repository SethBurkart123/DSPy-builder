"use client";

import { ConnectionLineComponentProps, getBezierPath, Position } from "reactflow";
import type { Port } from "./types";
import { edgeStyleForType } from "@/lib/flow-utils";

export function CustomConnectionLine({ 
  fromX, 
  fromY, 
  toX, 
  toY, 
  fromNode, 
  fromHandle,
}: ConnectionLineComponentProps) {
  let edgeColor = "#64748b"; // default gray
  
  if (fromNode && fromHandle && typeof fromHandle.id === 'string') {
    // Get the port ID from the handle ID and determine if it's input or output
    const handleId = fromHandle.id;
    let port: Port | undefined;
    
    if (handleId.startsWith('out-')) {
      // Dragging from an output port
      const portId = handleId.replace(/^out-/, '');
      port = fromNode.data.outputs?.find((p: Port) => p.id === portId);
    } else if (handleId.startsWith('in-')) {
      // Dragging from an input port (reverse connection)
      const portId = handleId.replace(/^in-/, '');
      port = fromNode.data.inputs?.find((p: Port) => p.id === portId);
    }
    
    if (port) {
      edgeColor = edgeStyleForType(port.type).stroke;
    }
  }

  // Determine the correct positions based on which handle we're dragging from
  let sourcePosition = Position.Right;
  let targetPosition = Position.Left;
  
  if (fromHandle && typeof fromHandle.id === 'string') {
    if (fromHandle.id.startsWith('out-')) {
      // Dragging from output port - curve should go outward (right)
      sourcePosition = Position.Right;
      targetPosition = Position.Left;
    } else if (fromHandle.id.startsWith('in-')) {
      // Dragging from input port - curve should go inward (left)
      sourcePosition = Position.Left;
      targetPosition = Position.Right;
    }
  }

  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition,
    targetX: toX,
    targetY: toY,
    targetPosition,
  });

  return (
    <g>
      <path fill="none" stroke={edgeColor} strokeWidth={3} strokeLinecap="round" d={edgePath} />
      <circle
        cx={toX}
        cy={toY}
        fill={edgeColor}
        r={3}
        stroke={edgeColor}
        strokeWidth={1.5}
      />
    </g>
  );
}
