"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, PlusCircle, Pencil, Trash2, Bot, User } from "lucide-react";
import type { TypedNodeData, NodeKind } from "@/components/flowbuilder/types";
import { getNodeTitle } from "@/lib/flow-utils";
import { api } from "@/lib/api";

type Message = { id: string; role: "user" | "assistant"; text: string };

const PANEL_WIDTH = 360;

const KIND_SYNONYMS: Record<string, NodeKind> = {
  "input": "input",
  "output": "output",
  "llm": "llm",
  "llm provider": "llm",
  "predict": "predict",
  "chain of thought": "chainofthought",
  "chain-of-thought": "chainofthought",
  "cot": "chainofthought",
  "agent": "agent",
  "wikipedia": "tool_wikipedia",
  "wiki": "tool_wikipedia",
  "math": "tool_math",
  "calculator": "tool_math",
  "python": "tool_python",
  "python tool": "tool_python",
};

function normalizeQuotes(s: string): string {
  return s.replace(/[“”]/g, '"').replace(/[‘’]/g, '\'');
}

function extractQuoted(text: string): string[] {
  const out: string[] = [];
  const rx = /"([^"]+)"|'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text))) {
    out.push(m[1] || m[2]);
  }
  return out;
}

function guessKindFromText(text: string): NodeKind | null {
  const t = text.toLowerCase();
  // Prefer longest matches first
  const keys = Object.keys(KIND_SYNONYMS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (t.includes(k)) return KIND_SYNONYMS[k];
  }
  return null;
}

export default function FlowAssistant({
  open,
  onClose,
  nodes,
  edges,
  onAddNode,
  onRenameNode,
  onDeleteNode,
  onRunAll,
}: {
  open: boolean;
  onClose: () => void;
  nodes: Node<TypedNodeData>[];
  edges: Edge[];
  onAddNode: (kind: NodeKind, title?: string) => { id: string; kind: NodeKind; title: string } | null;
  onRenameNode: (oldName: string, newName: string) => boolean;
  onDeleteNode: (name: string) => boolean;
  onRunAll?: () => void;
}) {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>("gpt-4o");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text:
        "Hi! I’m your AI Builder. I can propose changes and answer questions. Choose a model above (default: gpt-4o), then tell me what to do.",
    },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, open]);

  function append(role: Message["role"], text: string) {
    setMessages((prev) => prev.concat([{ id: crypto.randomUUID(), role, text }]));
  }

  function findNodeByName(name: string): Node<TypedNodeData> | null {
    const n = name.trim().toLowerCase();
    // Prefer exact title match; fallback to substring
    let found = nodes.find((x) => x.data.title?.toLowerCase() === n) || null;
    if (!found) found = nodes.find((x) => x.data.title?.toLowerCase().includes(n)) || null;
    return found || null;
  }

  async function handleCommand(raw: string) {
    const text = normalizeQuotes(raw).trim();
    if (!text) return;
    append("user", raw);
    setInput("");
    setSending(true);
    try {
      const resp = await api.chat({
        model,
        messages: [{ role: 'system', content: 'You are an expert DSPy flow builder. Be concise and helpful.' }].concat(
          messages.concat([{ id: crypto.randomUUID(), role: 'user', text: raw }]).map((m) => ({ role: m.role, content: m.text }))
        ) as any,
        temperature: 0.3,
      });
      append("assistant", resp.content || "(no content)");
    } catch (e: any) {
      const msg = e?.message || 'Failed to contact AI. Ensure API key is set in API Keys.';
      append("assistant", msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed top-14 right-0 h-[calc(100vh-56px)] border-l bg-background z-40 flex flex-col"
      style={{ width: open ? PANEL_WIDTH : 0, transition: 'width 150ms ease-in-out', overflow: 'hidden' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
        <div className="inline-flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4" /> AI Builder
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="gpt-4o">gpt-4o (OpenAI)</option>
            <option value="gpt-4o-mini">gpt-4o-mini (OpenAI)</option>
            <option value="gemini-2.5-pro">gemini-2.5-pro (Gemini)</option>
            <option value="gemini-2.5-flash">gemini-2.5-flash (Gemini)</option>
          </select>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex items-start gap-2 ${m.role === 'assistant' ? '' : 'justify-end'}`}>
            {m.role === 'assistant' && <Bot className="h-4 w-4 mt-1 text-muted-foreground" />}
            <div className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${m.role === 'assistant' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
              {m.text}
            </div>
            {m.role === 'user' && <User className="h-4 w-4 mt-1 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Composer */}
      <form
        className="p-3 border-t bg-background"
        onSubmit={(e) => {
          e.preventDefault();
          handleCommand(input);
        }}
      >
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='e.g., Add Predict node named "Summarizer"'
          />
          <Button type="submit" size="sm" disabled={sending}>{sending ? 'Sending…' : 'Send'}</Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const res = onAddNode('predict', 'Summarizer');
              if (res) append('assistant', 'Added Predict node: "Summarizer"');
            }}
          >
            <PlusCircle className="h-3 w-3 mr-1" /> Add Predict
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const ok = onRenameNode('Summarizer', 'Title');
              append('assistant', ok ? 'Renamed "Summarizer" to "Title".' : 'Could not find a node named "Summarizer".');
            }}
          >
            <Pencil className="h-3 w-3 mr-1" /> Rename
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const ok = onDeleteNode('Title');
              append('assistant', ok ? 'Deleted "Title".' : 'Could not find a node named "Title".');
            }}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => { onRunAll?.(); append('assistant', 'Running the entire flow.'); }}>
            Run All
          </Button>
        </div>
      </form>
    </div>
  );
}
