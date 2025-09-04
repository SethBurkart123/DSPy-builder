"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCcw, CheckCircle2, AlertCircle, Library, Undo2, Redo2, Download, Camera } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useRef, useState } from "react";
import KeysManager from "@/components/KeysManager";
import { Button } from "@/components/ui/button";
import { api, type FlowExportBundle } from "@/lib/api";
import { useRouter } from "next/navigation";
import { SchemaBrowser } from "@/components/schema/SchemaBrowser";
import { SchemaCreator } from "@/components/schema/SchemaCreator";
import type { CustomSchema } from "@/components/flowbuilder/types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function Topbar({ title, status = "idle", onBack, onRunAll, flowId, onUndo, onRedo, canUndo, canRedo, onToggleTrace, traceOpen }: { title: string; status?: SaveStatus; onBack?: () => void; onRunAll?: () => void; flowId: string; onUndo?: () => void; onRedo?: () => void; canUndo?: boolean; canRedo?: boolean; onToggleTrace?: () => void; traceOpen?: boolean }) {
  const [keysOpen, setKeysOpen] = useState(false);
  const [schemaBrowserOpen, setSchemaBrowserOpen] = useState(false);
  const [schemaCreatorOpen, setSchemaCreatorOpen] = useState(false);
  const [editingSchema, setEditingSchema] = useState<CustomSchema | null>(null);
  const router = useRouter();

  function slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
  }

  async function handleExport() {
    try {
      const bundle = await api.exportFlow(flowId);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fname = `${slugify(title || bundle.flow.name || "flow")}.flow.json`;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to export flow");
    }
  }

  async function handleSavePreview() {
    try {
      const mod = await import('html-to-image');
      const el = document.querySelector('.flow-builder .react-flow');
      if (!el) throw new Error('Canvas not found');
      // Temporarily hide minimap and controls for cleaner capture
      const toHide = Array.from(document.querySelectorAll('.react-flow__minimap, .react-flow__controls')) as HTMLElement[];
      const prevStyles: string[] = [];
      for (const n of toHide) { prevStyles.push(n.style.visibility); n.style.visibility = 'hidden'; }
      const dataUrl = await mod.toPng(el as HTMLElement, { cacheBust: true });
      // Restore
      toHide.forEach((n, i) => { n.style.visibility = prevStyles[i] || ''; });
      await api.setFlowPreview(flowId, dataUrl);
      alert('Preview saved');
    } catch (e) {
      console.error(e);
      alert('Failed to save preview. Ensure html-to-image is installed.');
    }
  }
  return (
    <div className="fixed inset-x-0 top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 items-center gap-3 px-4">
        {onBack ? (
          <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} />
            Back
          </button>
        ) : (
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} />
            Back
          </Link>
        )}
        <div className="mx-2 h-4 w-px bg-border" />
        <h1 className="truncate text-base font-semibold flex-1">{title}</h1>
        {status !== "idle" && (
          <span
            className="inline-flex items-center justify-center w-6 h-6"
            title={status === "saving" ? "Saving" : status === "saved" ? "Saved" : "Save failed; retrying"}
          >
            {status === "saving" && <RefreshCcw className="h-4 w-4 text-muted-foreground animate-spin" aria-label="Saving" />}
            {status === "saved" && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Saved" />}
            {status === "error" && <AlertCircle className="h-4 w-4 text-red-600" aria-label="Save failed" />}
          </span>
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSchemaBrowserOpen(true)} title="Schema Library">
            <Library className="h-4 w-4" />
            Schema Library
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} title="Export Flow">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleSavePreview} title="Save Preview">
            <Camera className="h-4 w-4" />
            Save Preview
          </Button>
          {onToggleTrace && (
            <Button variant={traceOpen ? "default" : "outline"} size="sm" onClick={onToggleTrace} title="Toggle Trace Panel">
              {traceOpen ? 'Close Trace' : 'Open Trace'}
            </Button>
          )}
          {onUndo && (
            <Button variant="outline" size="sm" onClick={onUndo} disabled={canUndo === false} title="Undo (Cmd/Ctrl+Z)">
              <Undo2 className="h-4 w-4" />
            </Button>
          )}
          {onRedo && (
            <Button variant="outline" size="sm" onClick={onRedo} disabled={canRedo === false} title="Redo (Cmd+Shift+Z / Ctrl+Y)">
              <Redo2 className="h-4 w-4" />
            </Button>
          )}
          {onRunAll && (
            <Button variant="default" size="sm" onClick={onRunAll} title="Run entire workflow">
              Run All
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setKeysOpen(true)} title="Manage API Keys">
            API Keys
          </Button>
          <ThemeToggle />
        </div>
      </div>
      <KeysManager open={keysOpen} onClose={() => setKeysOpen(false)} />
      {/* Schema Browser and Creator */}
      <SchemaBrowser
        isOpen={schemaBrowserOpen}
        onClose={() => setSchemaBrowserOpen(false)}
        onCreateNew={() => {
          setSchemaBrowserOpen(false);
          setEditingSchema(null);
          setSchemaCreatorOpen(true);
        }}
        onEdit={(schema) => {
          setSchemaBrowserOpen(false);
          setEditingSchema(schema);
          setSchemaCreatorOpen(true);
        }}
        flowId={flowId}
      />
      <SchemaCreator
        isOpen={schemaCreatorOpen}
        onClose={() => {
          setSchemaCreatorOpen(false);
          setEditingSchema(null);
        }}
        onSave={() => {
          setSchemaCreatorOpen(false);
        }}
        initialSchema={editingSchema ?? undefined}
        flowId={flowId}
      />
    </div>
  );
}
