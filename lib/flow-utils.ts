import type { Node } from "@xyflow/react";
import type { NodeKind, PortType, TypedNodeData, Port } from "@/components/flowbuilder/types";
import { PORT_HEX } from "@/components/flowbuilder/types";

export function getNodeTitle(kind: NodeKind): string {
  switch (kind) {
    case "chainofthought":
      return "Chain Of Thought";
    case "predict":
      return "Predict";
    case "input":
      return "Input";
    case "output":
      return "Output";
    case "llm":
      return "LLM Provider";
    case "agent":
      return "Agent (ReAct)";
    case "tool_wikipedia":
      return "Tool: Search Wikipedia";
    case "tool_math":
      return "Tool: Evaluate Math";
    case "tool_python":
      return "Tool: Custom Python";
    default:
      return String(kind);
  }
}

export function genId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function edgeStyleForType(portType?: PortType): { stroke: string; strokeWidth: number } {
  if (!portType) return { stroke: "#64748b", strokeWidth: 3 };
  if (portType === "llm") return { stroke: "#64748b", strokeWidth: 2 };
  return { stroke: PORT_HEX[portType] || "#64748b", strokeWidth: 3 };
}

export function portTypeForHandle(node: Node<TypedNodeData> | undefined, handleId: string | null | undefined): PortType | null {
  if (!node || !handleId) return null;
  const pid = handleId.replace(/^in-|^out-/, "");
  const isInput = handleId.startsWith("in-");
  const arr = isInput ? node.data.inputs : node.data.outputs;
  const port = arr.find((p) => p.id === pid);
  return port ? port.type : null;
}

export function findPortByHandle(node: Node<TypedNodeData> | undefined, handleId: string | null | undefined): Port | null {
  if (!node || !handleId) return null;
  const pid = handleId.replace(/^in-|^out-/, "");
  const arr = handleId.startsWith("in-") ? node.data.inputs : node.data.outputs;
  return arr.find((p) => p.id === pid) || null;
}

// Shared handle visuals
export const HANDLE_SIZE = 14; // px
export const NODE_GRID_PADDING_X = 12; // tailwind p-3
export const NODE_WIDTH = 240;
export const HEADER_HEIGHT = 41;
export const PORT_ROW_HEIGHT = 32;

export function handleStyleForPort(type: PortType): Record<string, any> {
  const base = { width: HANDLE_SIZE, height: HANDLE_SIZE, backgroundColor: PORT_HEX[type] } as Record<string, any>;
  switch (type) {
    case "string":
      return { ...base, borderRadius: HANDLE_SIZE };
    case "string[]":
      return { ...base, borderRadius: 2 };
    case "boolean":
      return { ...base, clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" };
    case "float":
      return { ...base, clipPath: "polygon(12% 50%, 28% 8%, 72% 8%, 88% 50%, 72% 92%, 28% 92%)" };
    case "int":
      return { ...base, clipPath: "polygon(50% 0, 0 100%, 100% 100%)" };
    case "object":
      return { ...base, borderRadius: 2 };
    case "array":
      return { ...base, clipPath: "polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%)" };
    case "llm":
      // Neutral gray block for LLM handles
      return { ...base, borderRadius: 2, backgroundColor: "#64748b" };
    case "tool":
      // Solid slate square for tools
      return { ...base, borderRadius: 2, backgroundColor: "#64748b" };
    default:
      return { ...base, borderRadius: HANDLE_SIZE };
  }
}
