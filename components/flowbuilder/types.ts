export type PortType = "string" | "string[]" | "boolean" | "float" | "int" | "object" | "array" | "llm";

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

export type NodeKind = "chainofthought" | "predict" | "input" | "output" | "llm";

export type TypedNodeData = {
  title: string;
  kind: NodeKind;
  inputs: Port[];
  outputs: Port[];
  // Optional node-level description (Signature docstring)
  description?: string;
  // Optional per-node LM settings or provider settings (used by LLM nodes and defaults on consumers)
  llm?: {
    model?: string;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };
  // Derived: whether the 'model' llm input is connected
  llmConnected?: boolean;
  // Optional ad-hoc values for ports (e.g., input node outputs or manual inputs when running in isolation)
  values?: Record<string, any>;
  // Runtime state for UI
  runtime?: {
    status?: "idle" | "running" | "done" | "error";
    outputs?: Record<string, any>;
    error?: string;
  };
};

export const PORT_COLORS: Record<PortType, string> = {
  string: "bg-emerald-500",
  "string[]": "bg-teal-500",
  boolean: "bg-amber-500",
  float: "bg-indigo-500",
  int: "bg-fuchsia-500",
  object: "bg-purple-500",
  array: "bg-cyan-500",
  llm: "bg-rose-500",
};

export const PORT_HEX: Record<PortType, string> = {
  string: "#10b981", // emerald-500
  "string[]": "#14b8a6", // teal-500
  boolean: "#f59e0b", // amber-500
  float: "#6366f1", // indigo-500
  int: "#d946ef", // fuchsia-500
  object: "#a855f7", // purple-500
  array: "#06b6d4", // cyan-500
  llm: "#f43f5e", // rose-500
};
