export type Flow = {
  id: string;
  name: string;
  slug: string;
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
};
