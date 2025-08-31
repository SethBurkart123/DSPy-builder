"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NodeKind } from "./types";

const OPTIONS: { key: NodeKind; label: string; description?: string }[] = [
  { key: "chainofthought", label: "Chain Of Thought", description: "Reason through steps with reasoning output" },
  { key: "predict", label: "Predict", description: "Make predictions without reasoning" },
];

export default function Palette({
  open,
  onClose,
  onChoose,
  connectionContext,
}: {
  open: boolean;
  onClose: () => void;
  onChoose: (kind: NodeKind) => void;
  connectionContext?: {
    portType: string;
    isFromOutput: boolean;
  };
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return OPTIONS;
    return OPTIONS.filter((o) => o.label.toLowerCase().includes(q) || o.key.includes(q));
  }, [query]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
      setIndex(0);
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[index];
        if (item) onChoose(item.key);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, index, onClose, onChoose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4" onClick={onClose}>
      <div className="mx-auto max-w-xl p-4" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes… (type then Enter)"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="mt-3 max-h-72 overflow-auto rounded-md border bg-background">
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No results</div>
          ) : (
            filtered.map((o, i) => (
              <button
                key={o.key}
                onClick={() => onChoose(o.key)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${
                  i === index ? "bg-accent text-accent-foreground" : ""
                }`}
              >
                <span className="font-medium">{o.label}</span>
                <span className="text-xs text-muted-foreground">{o.key}</span>
              </button>
            ))
          )}
        </div>
        <div className="mt-2 text-right text-xs text-accent">Enter to add • Esc to close</div>
      </div>
    </div>
  );
}

