"use client";

import { ConnectionLineComponentProps, getBezierPath, Position } from "reactflow";
import { PORT_HEX, type PortType, type Port } from "./types";

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
    
    if (port && port.type in PORT_HEX) {
      edgeColor = PORT_HEX[port.type as PortType];
    }
  }

  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: Position.Right,
    targetX: toX,
    targetY: toY,
    targetPosition: Position.Left,
  });

  return (
    <g>
      <path
        fill="none"
        stroke={edgeColor}
        strokeWidth={3}
        className="animated"
        d={edgePath}
      />
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
