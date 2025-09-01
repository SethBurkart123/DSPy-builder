"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

type Props = { open: boolean; onClose: () => void };

export default function KeysManager({ open, onClose }: Props) {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<{ provider: string; has_key: boolean }[]>([]);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [newProvider, setNewProvider] = useState("");
  const [newKey, setNewKey] = useState("");

  useEffect(() => {
    if (!open) return;
    api.listKeys().then((r) => setRows(r));
  }, [open]);

  async function save(provider: string) {
    setSaving((s) => ({ ...s, [provider]: true }));
    try {
      const key = keys[provider];
      if (!key || !key.trim()) return;
      await api.upsertKey(provider, key.trim());
      setRows((rs) => {
        const idx = rs.findIndex((x) => x.provider === provider);
        if (idx >= 0) {
          const next = [...rs];
          next[idx] = { ...next[idx], has_key: true };
          return next;
        }
        return [...rs, { provider, has_key: true }].sort((a, b) => a.provider.localeCompare(b.provider));
      });
      setKeys((k) => ({ ...k, [provider]: "" }));
    } finally {
      setSaving((s) => ({ ...s, [provider]: false }));
    }
  }

  async function saveNew() {
    const provider = newProvider.trim().toLowerCase();
    if (!provider || !newKey.trim()) return;
    await api.upsertKey(provider, newKey.trim());
    setRows((rs) => [...rs, { provider, has_key: true }].sort((a, b) => a.provider.localeCompare(b.provider)));
    setNewProvider("");
    setNewKey("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>API Keys</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {rows.map((p) => (
            <div key={p.provider} className="grid grid-cols-3 items-center gap-2">
              <div className="text-sm col-span-1">
                <div className="font-medium capitalize">{p.provider}</div>
                <div className="text-xs text-muted-foreground">{p.has_key ? "Loaded" : "Not set"}</div>
              </div>
              <Input
                className="col-span-2"
                type="password"
                placeholder={`${p.provider} API key`}
                value={keys[p.provider] ?? ""}
                onChange={(e) => setKeys((k) => ({ ...k, [p.provider]: e.target.value }))}
              />
              <div className="col-span-3 text-right">
                <Button size="sm" onClick={() => save(p.provider)} disabled={saving[p.provider] || !(keys[p.provider] ?? "").trim()}>
                  Save
                </Button>
              </div>
            </div>
          ))}
          <div className="border-t pt-3 mt-3">
            <div className="text-sm font-medium mb-2">Add Custom Provider</div>
            <div className="grid grid-cols-3 items-center gap-2">
              <Input className="col-span-1" placeholder="provider" value={newProvider} onChange={(e) => setNewProvider(e.target.value)} />
              <Input className="col-span-2" type="password" placeholder="API key" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
              <div className="col-span-3 text-right">
                <Button size="sm" onClick={saveNew} disabled={!newProvider.trim() || !newKey.trim()}>Save</Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
