export type PortType = "string" | "string[]" | "boolean" | "float" | "int";

export type Port = {
  id: string;
  name: string;
  type: PortType;
};

export type NodeKind = "chainofthought" | "classify" | "custom";

export type TypedNodeData = {
  title: string;
  kind: NodeKind;
  inputs: Port[];
  outputs: Port[];
};

export const PORT_COLORS: Record<PortType, string> = {
  string: "bg-emerald-500",
  "string[]": "bg-teal-500",
  boolean: "bg-amber-500",
  float: "bg-indigo-500",
  int: "bg-fuchsia-500",
};

export const PORT_HEX: Record<PortType, string> = {
  string: "#10b981", // emerald-500
  "string[]": "#14b8a6", // teal-500
  boolean: "#f59e0b", // amber-500
  float: "#6366f1", // indigo-500
  int: "#d946ef", // fuchsia-500
};
