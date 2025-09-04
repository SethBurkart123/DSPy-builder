"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type Flow, type FlowExportBundle } from "@/lib/api";
import Link from "next/link";
import { useRef } from "react";
import { Upload } from "lucide-react";

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default function FlowsDashboard() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listFlows();
      setFlows(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load flows");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Load previews lazily after flows
  useEffect(() => {
    let cancelled = false;
    async function loadPreviews() {
      const next: Record<string, string> = {};
      for (const f of flows) {
        try {
          const p = await api.getFlowPreview(f.id);
          next[f.id] = p.image;
        } catch {}
      }
      if (!cancelled) setPreviews(next);
    }
    if (flows.length) loadPreviews();
    return () => { cancelled = true; };
  }, [flows]);

  async function onCreate() {
    if (!createName.trim()) return;
    const created = await api.createFlow(createName.trim());
    setCreateName("");
    setCreateOpen(false);
    setFlows((f) => [created, ...f]);
  }

  function openRename(flow: Flow) {
    setRenameId(flow.id);
    setRenameName(flow.name);
    setRenameOpen(true);
  }

  async function onRename() {
    if (!renameId || !renameName.trim()) return;
    const updated = await api.renameFlow(renameId, renameName.trim());
    setFlows((f) => f.map((x) => (x.id === updated.id ? updated : x)));
    setRenameOpen(false);
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this flow?")) return;
    await api.deleteFlow(id);
    setFlows((f) => f.filter((x) => x.id !== id));
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Create, open, and manage flows</p>
        </div>
        <div className="flex gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={() => fileInputRef.current?.click()}
            title="Import Flow"
          >
            <Upload className="h-4 w-4" />
            Import
          </button>
          <button
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
            onClick={() => setCreateOpen(true)}
          >
            New Flow
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={load}
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="rounded-md border p-8 text-center text-sm text-red-500">{error}</div>
      ) : flows.length === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <p className="text-base font-medium">No flows yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first flow to get started.</p>
          <div className="mt-4">
            <button
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
              onClick={() => setCreateOpen(true)}
            >
              Create Flow
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {flows.map((flow) => (
            <div key={flow.id} className="rounded-lg border p-0 overflow-hidden">
              <div className="flex h-32">
                {/* Preview column */}
                <div className="relative bg-muted/30" style={{ width: '20%' }}>
                  {previews[flow.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previews[flow.id]} alt={`${flow.name} preview`} className="h-full w-full object-fill" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      No preview yet
                    </div>
                  )}
                </div>
                {/* Text + actions column */}
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-medium">{flow.name}</h3>
                      <p className="text-xs text-muted-foreground">{flow.slug}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/flow/${flow.id}`}
                      className="rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:opacity-90"
                    >
                      Open
                    </Link>
                    <button
                      className="rounded-md border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                      onClick={() => openRename(flow)}
                    >
                      Rename
                    </button>
                    <button
                      className="rounded-md border px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      onClick={() => onDelete(flow.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)}>
        <h3 className="text-base font-semibold">Create Flow</h3>
        <div className="mt-3">
          <label className="text-sm">Name</label>
          <input
            autoFocus
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onCreate()}
            placeholder="e.g. RAG Experiment"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setCreateOpen(false)}>
            Cancel
          </button>
          <button
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            onClick={onCreate}
            disabled={!createName.trim()}
          >
            Create
          </button>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)}>
        <h3 className="text-base font-semibold">Rename Flow</h3>
        <div className="mt-3">
          <label className="text-sm">Name</label>
          <input
            autoFocus
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onRename()}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setRenameOpen(false)}>
            Cancel
          </button>
          <button
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            onClick={onRename}
            disabled={!renameName.trim()}
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
    <input
      ref={fileInputRef}
      type="file"
      accept="application/json"
      style={{ display: 'none' }}
      onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const obj = JSON.parse(text) as FlowExportBundle;
          if (!obj || typeof obj !== 'object' || !obj.flow || !obj.state) throw new Error('Invalid bundle');
          const res = await api.importFlow(obj);
          setFlows((f) => [res.flow, ...f]);
        } catch (err) {
          alert('Failed to import flow');
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }}
    />
    </>
  );
}
