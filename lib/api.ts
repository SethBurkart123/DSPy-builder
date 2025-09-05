export type Flow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

export type FlowState = {
  flow_id: string;
  data: {
    nodes: any[];
    edges: any[];
    // optionally include viewport or other metadata in future
    [k: string]: any;
  };
  updated_at: string;
};

// Schemas API types (server-side models)
export type ApiSchemaField = {
  id: string;
  name: string;
  type: string;
  description?: string;
  required: boolean;
  arrayItemType?: string | null;
  arrayItemSchemaId?: string | null;
  objectSchemaId?: string | null;
  customType?: string | null;
  arrayItemCustomType?: string | null;
  literalKind?: "string" | "int" | "float" | "boolean" | null;
  literalValues?: (string | number | boolean)[] | null;
};

export type ApiFlowSchema = {
  id: string;
  flow_id: string;
  name: string;
  description?: string | null;
  fields: ApiSchemaField[];
  created_at: string;
  updated_at: string;
};

export type FlowExportBundle = {
  version: number;
  flow: Flow;
  state: { [k: string]: any };
  schemas: ApiFlowSchema[];
};

export type FlowImportResult = {
  flow: Flow;
};

export type FlowPreview = {
  flow_id: string;
  image: string;
  updated_at: string;
};

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const BASE = `${API_BASE}/api`;

async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  listFlows: () => http<Flow[]>(`${BASE}/flows/`),
  createFlow: (name: string) =>
    http<Flow>(`${BASE}/flows/`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  getFlow: (id: string) => http<Flow>(`${BASE}/flows/${id}`),
  renameFlow: (id: string, name: string) =>
    http<Flow>(`${BASE}/flows/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deleteFlow: (id: string) =>
    http<{ ok: boolean }>(`${BASE}/flows/${id}`, { method: "DELETE" }),
  getFlowState: (id: string) => http<FlowState>(`${BASE}/flows/${id}/state`),
  saveFlowState: (id: string, data: FlowState["data"]) =>
    http<FlowState>(`${BASE}/flows/${id}/state`, {
      method: "PUT",
      body: JSON.stringify({ data }),
    }),
  listFlowSchemas: (flowId: string) =>
    http<ApiFlowSchema[]>(`${BASE}/flows/${flowId}/schemas`),
  createFlowSchema: (
    flowId: string,
    data: { name: string; description?: string | null; fields: ApiSchemaField[] }
  ) =>
    http<ApiFlowSchema>(`${BASE}/flows/${flowId}/schemas`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getFlowSchema: (flowId: string, schemaId: string) =>
    http<ApiFlowSchema>(`${BASE}/flows/${flowId}/schemas/${schemaId}`),
  updateFlowSchema: (
    flowId: string,
    schemaId: string,
    data: { name: string; description?: string | null; fields: ApiSchemaField[] }
  ) =>
    http<ApiFlowSchema>(`${BASE}/flows/${flowId}/schemas/${schemaId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteFlowSchema: (flowId: string, schemaId: string) =>
    http<{ ok: boolean }>(`${BASE}/flows/${flowId}/schemas/${schemaId}`, { method: "DELETE" }),
  // API keys
  listKeys: () => http<{ provider: string; has_key: boolean; updated_at?: string | null }[]>(`${BASE}/keys/`),
  upsertKey: (provider: string, api_key: string) =>
    http<{ provider: string; has_key: boolean; updated_at?: string | null }>(`${BASE}/keys/${provider}`, {
      method: "PUT",
      body: JSON.stringify({ api_key }),
    }),
  deleteKey: (provider: string) => http<{ ok: boolean }>(`${BASE}/keys/${provider}`, { method: "DELETE" }),
  runNode: (
    flowId: string,
    data: {
      node_kind: string;
      node_title?: string;
      node_description?: string;
      inputs_schema: { name: string; type: string; description?: string }[];
      outputs_schema: { name: string; type: string; description?: string }[];
      inputs_values: Record<string, any>;
      model?: string;
      lm_params?: Record<string, any>;
      tools_code?: string[];
    }
  ) =>
    http<{ outputs?: Record<string, any>; reasoning?: any; error?: string }>(
      `${BASE}/flows/${flowId}/run/node`,
      { method: "POST", body: JSON.stringify(data) }
    ),
  runNodeStream: (
    flowId: string,
    data: {
      node_id?: string;
      node_kind: string;
      node_title?: string;
      node_description?: string;
      inputs_schema: { name: string; type: string; description?: string }[];
      outputs_schema: { name: string; type: string; description?: string }[];
      inputs_values: Record<string, any>;
      model?: string;
      lm_params?: Record<string, any>;
      tools_code?: string[];
    }
  ) => fetch(
    `${BASE}/flows/${flowId}/run/node/stream`,
    {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    }
  ),
  // Import/Export
  exportFlow: (flowId: string) => http<FlowExportBundle>(`${BASE}/flows/${flowId}/export`),
  importFlow: (bundle: FlowExportBundle) =>
    http<FlowImportResult>(`${BASE}/flows/import`, { method: "POST", body: JSON.stringify(bundle) }),
  // Previews
  getFlowPreview: (flowId: string) => http<FlowPreview>(`${BASE}/flows/${flowId}/preview`),
  setFlowPreview: (flowId: string, image: string) =>
    http<FlowPreview>(`${BASE}/flows/${flowId}/preview`, { method: "PUT", body: JSON.stringify({ image }) }),
  // AI
  chat: (data: { model: string; messages: { role: 'system' | 'user' | 'assistant'; content: string }[]; temperature?: number }) =>
    http<{ content: string }>(`${BASE}/ai/chat`, { method: 'POST', body: JSON.stringify(data) }),
};
