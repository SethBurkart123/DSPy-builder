export type PortType = "string" | "string[]" | "boolean" | "float" | "int" | "object" | "array";

export type Port = {
  id: string;
  name: string;
  type: PortType;
  // For custom objects and arrays
  customSchema?: CustomSchema;
  arrayItemType?: PortType;
  arrayItemSchema?: CustomSchema;
  description?: string;
  locked?: boolean;
};

// Schema definition interfaces
export interface SchemaField {
  id: string;
  name: string;
  type: PortType;
  description?: string;
  required: boolean;
  arrayItemType?: PortType;
  // Store references by id instead of embedding full schemas
  arrayItemSchemaId?: string;
  objectSchemaId?: string;
}

export interface CustomSchema {
  id: string;
  name: string;
  description?: string;
  fields: SchemaField[];
}

export type NodeKind = "chainofthought" | "predict" | "input" | "output";

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
  object: "bg-purple-500",
  array: "bg-cyan-500",
};

export const PORT_HEX: Record<PortType, string> = {
  string: "#10b981", // emerald-500
  "string[]": "#14b8a6", // teal-500
  boolean: "#f59e0b", // amber-500
  float: "#6366f1", // indigo-500
  int: "#d946ef", // fuchsia-500
  object: "#a855f7", // purple-500
  array: "#06b6d4", // cyan-500
};
