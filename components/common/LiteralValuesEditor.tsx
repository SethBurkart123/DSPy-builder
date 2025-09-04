"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Kind = "string" | "int" | "float" | "boolean";

export function LiteralValuesEditor({
  kind,
  values,
  onKindChange,
  onChange,
  baseKindLabel = "Base kind",
  valuesLabel = "Allowed values",
  compact = false,
}: {
  kind: Kind | undefined;
  values: (string | number | boolean)[] | undefined;
  onKindChange?: (k: Kind) => void;
  onChange: (vals: (string | number | boolean)[]) => void;
  baseKindLabel?: string;
  valuesLabel?: string;
  compact?: boolean;
}) {
  const [pending, setPending] = useState("");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const coerce = (raw: string): string | number | boolean | null => {
    const s = raw.trim();
    if (!s) return null;
    if (!kind || kind === "string") return s;
    if (kind === "boolean") return s.toLowerCase() === "true";
    if (kind === "int") {
      const n = Number.parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    }
    if (kind === "float") {
      const n = Number.parseFloat(s);
      return Number.isFinite(n) ? n : null;
    }
    return s;
  };

  const addMany = (texts: string[]) => {
    const next = [...(values || [])];
    texts.forEach((t) => {
      const v = coerce(t);
      if (v !== null) next.push(v);
    });
    onChange(next);
  };

  const handleAdd = () => {
    const v = coerce(pending);
    if (v !== null) {
      onChange([...(values || []), v]);
      setPending("");
    }
  };

  const handleKeyDown = (e: any) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === "," && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const handlePaste = (e: any) => {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    const parts = text.split(/,|\n/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      e.preventDefault();
      addMany(parts);
      setPending("");
    }
  };

  const startEdit = (idx: number) => {
    setEditIndex(idx);
    setEditValue(String(values?.[idx] ?? ""));
  };

  const commitEdit = () => {
    if (editIndex === null) return;
    const v = coerce(editValue);
    if (v !== null) {
      const next = [...(values || [])];
      next[editIndex] = v;
      onChange(next);
    }
    setEditIndex(null);
    setEditValue("");
  };

  const removeAt = (idx: number) => {
    const next = (values || []).filter((_, i) => i !== idx);
    onChange(next);
    if (editIndex === idx) {
      setEditIndex(null);
      setEditValue("");
    }
  };

  return (
    <div className="space-y-2">
      {onKindChange && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{baseKindLabel}:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size={compact ? "sm" : "default"}>
                <span className="ml-1">{kind || "Select kind"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(["string", "int", "float", "boolean"] as const).map((k) => (
                <DropdownMenuItem key={k} onClick={() => onKindChange(k)}>
                  {k}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">{valuesLabel}:</span>
        <div className="flex flex-wrap gap-1">
          {(values || []).map((val, idx) => (
            <div key={idx} className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[11px] border">
              {editIndex === idx ? (
                <input
                  className="bg-transparent outline-none w-24"
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") {
                      setEditIndex(null);
                      setEditValue("");
                    }
                  }}
                />
              ) : (
                <button className="cursor-text" onClick={() => startEdit(idx)} title="Click to edit">
                  {String(val)}
                </button>
              )}
              <button className="ml-1 text-[10px] opacity-70 hover:opacity-100" onClick={() => removeAt(idx)} aria-label="Remove">
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Input
            className={`text-xs flex-1 ${compact ? "h-7" : ""}`}
            placeholder={
              !kind || kind === "string"
                ? "Type a value and press Enter"
                : kind === "boolean"
                ? "true or false"
                : "e.g., 1 or 2.5"
            }
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
          />
          <Button size="sm" variant="outline" onClick={handleAdd}>
            Add
          </Button>
        </div>
        <div className="text-[10px] text-muted-foreground">Tip: paste comma- or newline-separated values; press Enter to add.</div>
      </div>
    </div>
  );
}

