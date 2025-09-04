"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Loader2, Bot, Wrench, Brain, CheckCircle2, AlertTriangle } from "lucide-react";
import type { TypedNodeData, Port } from "@/components/flowbuilder/types";

type RunInputs = Record<string, any>;

export function FlowTracePanel({
  open,
  onClose,
  flowId,
  nodes,
  edges,
  onRunWithInputs,
}: {
  open: boolean;
  onClose: () => void;
  flowId: string;
  nodes: Node<TypedNodeData>[];
  edges: Edge[];
  onRunWithInputs: (values: RunInputs) => Promise<void> | void;
}) {
  const panelWidth = 420;
  const inputNode = useMemo(() => nodes.find(n => n.data.kind === 'input') || null, [nodes]);

  const inputPorts = useMemo<Port[]>(() => inputNode?.data.outputs || [], [inputNode]);
  const [values, setValues] = useState<RunInputs>({});
  const [running, setRunning] = useState(false);
  const [session, setSession] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Initialize form from input node when it changes
    const initial: RunInputs = {};
    for (const p of inputPorts) {
      const existing = inputNode?.data.values?.[p.name];
      if (existing !== undefined) initial[p.name] = existing;
      else initial[p.name] = defaultValueFor(p);
    }
    setValues(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputNode?.id, inputPorts.length]);

  const computeNodes = useMemo(() => nodes.filter(n => ['predict','chainofthought','agent'].includes(n.data.kind)), [nodes]);

  // Persistent transcript across runs and clears
  type TranscriptItem = { nodeId: string; nodeTitle: string; nodeKind: string; ev: any };
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const processedRef = useRef<Record<string, number>>({});

  useEffect(() => {
    // Append any new events since last scan
    const pending: TranscriptItem[] = [];
    const container = scrollRef.current;
    const wasAtBottom = container ? (container.scrollTop + container.clientHeight >= container.scrollHeight - 20) : false;
    for (const n of computeNodes) {
      const evs = n.data.runtime?.events || [];
      let processed = processedRef.current[n.id] || 0;
      // If runtime was cleared, reset processed pointer
      if (evs.length < processed) processed = 0;
      if (evs.length > processed) {
        for (let i = processed; i < evs.length; i++) {
          pending.push({ nodeId: n.id, nodeTitle: n.data.title, nodeKind: n.data.kind, ev: evs[i] });
        }
        processedRef.current[n.id] = evs.length;
      }
    }
    if (pending.length) {
      setTranscript(prev => prev.concat(pending));
      // If the user was already at bottom, auto-scroll as new items stream in
      if (wasAtBottom) {
        requestAnimationFrame(() => {
          const el = scrollRef.current;
          if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        });
      }
    }
  }, [computeNodes.map(n => n.data.runtime?.events?.length || 0).join('|')]);

  const finalOutputs = useMemo(() => {
    // Aggregate outputs from Output node(s)
    const outs: { nodeId: string; items: { name: string; value: any }[] }[] = [];
    const outputNodes = nodes.filter(n => n.data.kind === 'output');
    for (const outNode of outputNodes) {
      const items: { name: string; value: any }[] = [];
      for (const p of outNode.data.inputs) {
        const e = edges.find(ed => ed.target === outNode.id && ed.targetHandle === `in-${p.id}`);
        if (!e) { items.push({ name: p.name, value: undefined }); continue; }
        const src = nodes.find(n => n.id === e.source);
        if (!src) { items.push({ name: p.name, value: undefined }); continue; }
        const srcPortId = (e.sourceHandle || '').replace('out-', '');
        const sp = src.data.outputs.find(op => op.id === srcPortId);
        const srcName = sp?.name || '';
        let v: any = undefined;
        if (src.data.kind === 'input') v = src.data.values?.[srcName];
        else v = src.data.runtime?.outputs?.[srcName];
        items.push({ name: p.name, value: v });
      }
      outs.push({ nodeId: outNode.id, items });
    }
    return outs;
  }, [nodes, edges, session]);

  const visibleOutputs = useMemo(() => {
    return finalOutputs
      .map(group => ({
        nodeId: group.nodeId,
        items: group.items.filter(it => !isEmptyValue(it.value)),
      }))
      .filter(group => group.items.length > 0);
  }, [finalOutputs]);

  async function handleRun() {
    // Start a fresh transcript for this run
    setTranscript([]);
    processedRef.current = {};
    setRunning(true);
    try {
      await onRunWithInputs(values);
      setSession(s => s + 1);
    } finally {
      setRunning(false);
    }
  }

  function renderField(p: Port) {
    const key = p.name;
    const v = values[key];
    const set = (nv: any) => setValues(prev => ({ ...prev, [key]: nv }));
    if (p.type === 'string') {
      return <Input value={v ?? ''} onChange={(e) => set(e.target.value)} placeholder={p.description || p.name} />;
    }
    if (p.type === 'int' || p.type === 'float') {
      return (
        <Input type="number" value={v ?? ''} onChange={(e) => {
          const num = p.type === 'int' ? (e.target.value === '' ? '' : parseInt(e.target.value, 10)) : (e.target.value === '' ? '' : parseFloat(e.target.value));
          set(Number.isNaN(num as any) ? '' : num);
        }} />
      );
    }
    if (p.type === 'boolean') {
      return (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} />
          <span>{p.description || p.name}</span>
        </label>
      );
    }
    // Simple JSON for arrays/objects/custom
    return (
      <Textarea
        className="text-xs"
        rows={3}
        value={(() => { try { return typeof v === 'string' ? v : JSON.stringify(v ?? defaultValueFor(p), null, 2); } catch { return String(v ?? ''); } })()}
        onChange={(e) => {
          const raw = e.target.value;
          try {
            const parsed = JSON.parse(raw);
            set(parsed);
          } catch {
            // keep as string until valid
            set(raw);
          }
        }}
        placeholder={p.description || p.name}
      />
    );
  }

  return (
    <div
      className="fixed top-14 right-0 h-[calc(100vh-56px)] border-l bg-background z-40 flex flex-col"
      style={{ width: open ? panelWidth : 0, transition: 'width 150ms ease-in-out', overflow: 'hidden' }}
    >
      <style jsx>{`
        @keyframes shimmerText {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer-text {
          background: linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.15) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          background-size: 200% 100%;
          animation: shimmerText 1.6s linear infinite;
        }
        .shimmer-dim { opacity: 0.7; }
      `}</style>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
        <div className="font-medium text-sm">Flow Trace</div>
        <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-4" onScroll={() => {
        // No sticky state we need to store persistently; detection happens per append
      }}>
        {/* Inputs */}
        <section className="rounded-md border p-3 bg-card">
          <div className="mb-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Inputs</div>
          </div>
          {inputNode ? (
            <div className="space-y-3">
              {inputPorts.map((p) => (
                <div key={p.id} className="space-y-1">
                  {p.type !== 'boolean' && (
                    <div className="text-[11px] font-medium text-muted-foreground">{p.name}</div>
                  )}
                  {renderField(p)}
                  {p.description && p.type !== 'boolean' && (
                    <div className="text-[10px] text-muted-foreground">{p.description}</div>
                  )}
                </div>
              ))}
              <Button className="w-full" onClick={handleRun} disabled={running}>{running ? 'Running…' : 'Run Flow'}</Button>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Add an Input node to configure flow inputs.</div>
          )}
        </section>

        {/* Live trace grouped by node */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Trace</div>
            {transcript.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setTranscript([])}>Clear</Button>
            )}
          </div>
          {/* Group transcript by node */}
          {Object.values(groupByNode(transcript)).map(group => {
            const node = nodes.find(n => n.id === group.nodeId);
            const running = node?.data.runtime?.status === 'running';
            // Build grouped steps from node events (hide run_start/run_end)
            let steps = buildSteps(group.items.map(i => i.ev));
            // If node is running but no specific step is currently running, add a placeholder spinner step
            if (running && !steps.some(s => (s as any).running)) {
              steps = steps.concat([{ type: 'thinking', title: 'Thinking', running: true, placeholder: true } as any]);
            }
            return (
              <div key={group.nodeId}>
                {/* Node heading (no background block), with spinner when running */}
                <div className="flex items-center gap-2 px-1 py-2">
                  <span className="text-sm font-medium">{group.nodeTitle}</span>
                  <span className="text-[10px] rounded bg-muted px-2 py-0.5">{group.nodeKind}</span>
                  {running && <Loader2 className="h-3.5 w-3.5 animate-spin opacity-80" />}
                </div>
                {/* Connected accordion list */}
                {steps.length > 0 ? (
                  <div className="rounded-lg border bg-card/50 overflow-hidden">
                    <Accordion type="multiple" className="divide-y">
                      {steps.map((step, idx) => (
                        (step as any).placeholder ? (
                          <div key={idx} className="px-5 py-4 flex items-center justify-between select-none">
                            <div className="flex items-center gap-2">
                              {stepIcon('thinking')}
                              <span className="text-sm font-medium shimmer-dim shimmer-text">Thinking…</span>
                            </div>
                            <Loader2 className="h-4 w-4 animate-spin opacity-70" />
                          </div>
                        ) : (
                          <AccordionItem key={idx} value={`item-${idx}`}>
                            <AccordionTrigger className="w-full text-left px-5 py-4 hover:no-underline hover:bg-card">
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                  {stepIcon(step.type)}
                                  <span className="text-sm font-medium">{step.title}</span>
                                </div>
                                {step.running && <Loader2 className="h-4 w-4 animate-spin opacity-70" />}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-3 py-2">
                              {renderStepBody(step)}
                            </AccordionContent>
                          </AccordionItem>
                        )
                      ))}
                    </Accordion>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground px-1">No activity yet.</div>
                )}
              </div>
            );
          })}
        </section>

        {/* Final outputs (only when there is visible content) */}
        {visibleOutputs.length > 0 && (
          <section className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Outputs</div>
            {visibleOutputs.map(group => (
              <div key={group.nodeId} className="rounded-md border bg-card p-3 space-y-2">
                {group.items.map((item, i) => (
                  <div key={`${group.nodeId}-${i}`}>
                    <div className="text-[11px] font-medium text-muted-foreground">{item.name}</div>
                    <div className="mt-1 text-[12px]">
                      {renderValue(item.value)}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function defaultValueFor(p: Port): any {
  switch (p.type) {
    case 'string': return '';
    case 'int': return '';
    case 'float': return '';
    case 'boolean': return false;
    case 'string[]': return [];
    default: return null;
  }
}

function renderValue(v: any) {
  if (v === null || v === undefined) return <span className="text-muted-foreground">(empty)</span>;
  if (typeof v === 'string') {
    const parsed = parsePredictionString(v);
    if (parsed) {
      const entries = Object.entries(parsed).filter(([_, val]) => !isEmptyValue(val));
      return (
        <div className="space-y-2">
          {entries.map(([k, val]) => (
            <div key={k}>
              <div className="text-[11px] font-medium text-muted-foreground capitalize">{k}</div>
              <div className="text-[12px] whitespace-pre-wrap">{typeof val === 'string' ? val : JSON.stringify(val)}</div>
            </div>
          ))}
        </div>
      );
    }
    return <span className="whitespace-pre-wrap">{v}</span>;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return <span>{String(v)}</span>;
  if (Array.isArray(v)) {
    return (
      <ul className="list-disc pl-5 space-y-1">
        {v.map((item, i) => (<li key={i}>{renderValue(item)}</li>))}
      </ul>
    );
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v);
    return (
      <div className="space-y-1">
        {entries.map(([k, val]) => (
          <div key={k} className="grid grid-cols-3 gap-2 items-start">
            <div className="col-span-1 text-[11px] font-medium text-muted-foreground break-words">{k}</div>
            <div className="col-span-2 text-[12px] break-words">{renderValue(val)}</div>
          </div>
        ))}
      </div>
    );
  }
  try { return <span className="whitespace-pre-wrap">{JSON.stringify(v, null, 2)}</span>; } catch { return <span>{String(v)}</span>; }
}

function isEmptyValue(v: any): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0 || v.every(isEmptyValue);
  if (typeof v === 'object') {
    const entries = Object.entries(v);
    if (entries.length === 0) return true;
    return entries.every(([_, val]) => isEmptyValue(val));
  }
  return false;
}

function parsePredictionString(s: string): Record<string, any> | null {
  const prefix = 'Prediction(';
  const start = s.indexOf(prefix);
  const end = s.lastIndexOf(')');
  if (start !== 0 || end <= start) return null;
  const inner = s.slice(prefix.length, end);
  // Regex to capture key='value' or key="value" or key=null/None
  const re = /(\w+)\s*=\s*(?:'([^']*)'|"([^"]*)"|None|null)/gs;
  const out: Record<string, any> = {};
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    const key = m[1];
    const single = m[2];
    const dbl = m[3];
    const val = single ?? dbl ?? null;
    out[key] = val;
  }
  if (Object.keys(out).length === 0) return null;
  return out;
}

export default FlowTracePanel;

function groupByNode(items: { nodeId: string; nodeTitle: string; nodeKind: string; ev: any }[]) {
  const map: Record<string, { nodeId: string; nodeTitle: string; nodeKind: string; items: { ev: any }[] }> = {};
  for (const it of items) {
    const key = it.nodeId;
    if (!map[key]) map[key] = { nodeId: it.nodeId, nodeTitle: it.nodeTitle, nodeKind: it.nodeKind, items: [] };
    map[key].items.push({ ev: it.ev });
  }
  return map;
}

// ---- Step grouping helpers ----
type Step =
  | { type: 'lm'; title: string; running: boolean; prompt?: string; response?: string; exception?: any }
  | { type: 'tool'; title: string; running: boolean; tool?: string; inputs?: any; output?: any; exception?: any; call_id?: string | number | null; index?: number | null }
  | { type: 'thinking'; title: string; running: boolean; outputs?: any; exception?: any; placeholder?: boolean }
  | { type: 'result'; title: string; running: false; outputs?: any }
  | { type: 'error'; title: string; running: false; message?: string };

function buildSteps(events: any[]): Step[] {
  // Remove run lifecycle
  const evs = events.filter(e => e && e.event && e.event !== 'run_start' && e.event !== 'run_end');
  const steps: Step[] = [];

  // Pending maps for grouping
  let pendingLM: any | null = null;
  const pendingToolsByKey: Record<string, any> = {};

  const toolKey = (e: any) => {
    if (e.call_id) return `call:${e.call_id}`;
    if (e.tool_index !== undefined && e.tool_index !== null) return `idx:${e.tool_index}`;
    return `name:${e.tool || 'tool'}`;
  };

  for (const e of evs) {
    switch (e.event) {
      case 'lm_start':
        // Close any previous unclosed LM step as running, then start new
        if (pendingLM) {
          steps.push({ type: 'lm', title: 'LM', running: true, prompt: pendingLM.prompt });
        }
        pendingLM = e;
        break;
      case 'lm_end': {
        const prompt = pendingLM?.prompt;
        steps.push({ type: 'lm', title: 'LM', running: false, prompt, response: e.response, exception: e.exception });
        pendingLM = null;
        break;
      }
      case 'tool_start': {
        const key = toolKey(e);
        pendingToolsByKey[key] = e;
        // Optimistically add as running; will be replaced/updated on end
        steps.push({ type: 'tool', title: e.tool || 'Tool', running: true, tool: e.tool, inputs: e.inputs, call_id: e.call_id ?? null, index: e.tool_index ?? null });
        break;
      }
      case 'tool_end': {
        const key = toolKey(e);
        // Find the last running tool step for this key and update it
        for (let i = steps.length - 1; i >= 0; i--) {
          const s = steps[i];
          if (s.type === 'tool') {
            const matches = (s.call_id && e.call_id && s.call_id === e.call_id) || (s.index !== undefined && s.index !== null && e.tool_index !== undefined && s.index === e.tool_index) || (!s.call_id && !e.call_id && s.tool === e.tool);
            if (matches) {
              steps[i] = { type: 'tool', title: e.tool || s.title || 'Tool', running: false, tool: e.tool || s.tool, inputs: s.inputs, output: e.output, exception: e.exception, call_id: s.call_id ?? e.call_id ?? null, index: s.index ?? e.tool_index ?? null };
              break;
            }
          }
        }
        delete pendingToolsByKey[key];
        break;
      }
      case 'module_start': {
        // Show thinking as running
        steps.push({ type: 'thinking', title: 'Thinking', running: true });
        break;
      }
      case 'module_end': {
        // Update last running thinking step if present
        let updated = false;
        for (let i = steps.length - 1; i >= 0; i--) {
          if (steps[i].type === 'thinking' && steps[i].running) {
            steps[i] = { type: 'thinking', title: 'Thinking', running: false, outputs: e.outputs, exception: e.exception };
            updated = true;
            break;
          }
        }
        if (!updated) steps.push({ type: 'thinking', title: 'Thinking', running: false, outputs: e.outputs, exception: e.exception });
        break;
      }
      case 'result':
        steps.push({ type: 'result', title: 'Result', running: false, outputs: e.outputs });
        break;
      case 'error':
        steps.push({ type: 'error', title: 'Error', running: false, message: e.message });
        break;
      default:
        break;
    }
  }

  // If an LM is still pending, keep as running
  if (pendingLM) steps.push({ type: 'lm', title: 'LM', running: true, prompt: pendingLM.prompt });

  return steps;
}

function stepIcon(t: Step['type']) {
  const cls = "h-4 w-4 text-muted-foreground";
  if (t === 'lm') return <Bot className={cls} />;
  if (t === 'tool') return <Wrench className={cls} />;
  if (t === 'thinking') return <Brain className={cls} />;
  if (t === 'result') return <CheckCircle2 className={cls} />;
  if (t === 'error') return <AlertTriangle className="h-4 w-4 text-red-500" />;
  return null;
}

function renderStepBody(step: Step) {
  switch (step.type) {
    case 'lm':
      return (
        <div className="space-y-2">
          {step.prompt && (
            <div>
              <div className="text-[11px] font-medium text-muted-foreground">Prompt</div>
              <div className="p-2 text-[12px] whitespace-pre-wrap">{step.prompt}</div>
            </div>
          )}
          {step.response && (
            <div>
              <div className="text-[11px] font-medium text-muted-foreground">Response</div>
              <div className="p-2 text-[12px] whitespace-pre-wrap">{step.response}</div>
            </div>
          )}
          {step.exception && <div className="text-[11px] text-red-600">{String(step.exception)}</div>}
        </div>
      );
    case 'tool':
      return (
        <div className="space-y-2">
          {!isEmptyValue(step.inputs) && (
            <div>
              <div className="text-[11px] font-medium text-muted-foreground">Inputs</div>
              <div className="text-[12px]">{renderValue(step.inputs)}</div>
            </div>
          )}
          {!isEmptyValue(step.output) && (
            <div>
              <div className="text-[11px] font-medium text-muted-foreground">Output</div>
              <div className="text-[12px]">{renderValue(step.output)}</div>
            </div>
          )}
          {step.exception && <div className="text-[11px] text-red-600">{String(step.exception)}</div>}
        </div>
      );
    case 'thinking':
      return (
        <div className="space-y-2">
          {!isEmptyValue(step.outputs) && (
            <div className="text-[12px]">{renderValue(step.outputs)}</div>
          )}
          {step.exception && <div className="text-[11px] text-red-600">{String(step.exception)}</div>}
        </div>
      );
    case 'result':
      return (
        <div className="space-y-2">
          {!isEmptyValue(step.outputs) && (
            <div>
              <div className="text-[11px] font-medium text-muted-foreground">Outputs</div>
              <div className="text-[12px]">{renderValue(step.outputs)}</div>
            </div>
          )}
        </div>
      );
    case 'error':
      return <div className="text-[11px] text-red-600">{step.message}</div>;
  }
}
