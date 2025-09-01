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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
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
};
