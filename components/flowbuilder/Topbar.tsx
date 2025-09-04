"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCcw, CheckCircle2, AlertCircle, Library, Undo2, Redo2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState } from "react";
import KeysManager from "@/components/KeysManager";
import { Button } from "@/components/ui/button";
import { SchemaBrowser } from "@/components/schema/SchemaBrowser";
import { SchemaCreator } from "@/components/schema/SchemaCreator";
import type { CustomSchema } from "@/components/flowbuilder/types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function Topbar({ title, status = "idle", onBack, onRunAll, flowId, onUndo, onRedo, canUndo, canRedo }: { title: string; status?: SaveStatus; onBack?: () => void; onRunAll?: () => void; flowId: string; onUndo?: () => void; onRedo?: () => void; canUndo?: boolean; canRedo?: boolean }) {
  const [keysOpen, setKeysOpen] = useState(false);
  const [schemaBrowserOpen, setSchemaBrowserOpen] = useState(false);
  const [schemaCreatorOpen, setSchemaCreatorOpen] = useState(false);
  const [editingSchema, setEditingSchema] = useState<CustomSchema | null>(null);
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
