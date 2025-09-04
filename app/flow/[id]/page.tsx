"use client";

import { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  Edge,
  Node,
  useEdgesState,
  useNodesState,
  BackgroundVariant,
  OnConnectStart,
  OnConnectEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import Topbar from "@/components/flowbuilder/Topbar";
import NodeInspector from "@/components/flowbuilder/NodeInspector";
import { TypedNode } from "@/components/flowbuilder/TypedNode";
import { CustomConnectionLine } from "@/components/flowbuilder/CustomConnectionLine";
import type { TypedNodeData, Port, NodeKind, PortType } from "@/components/flowbuilder/types";
import { api } from "@/lib/api";
import Palette from "@/components/flowbuilder/Palette";
import { toast } from "react-hot-toast";
import type { ColorMode, ReactFlowInstance } from "@xyflow/react";
import { getNodeTitle, edgeStyleForType, portTypeForHandle, NODE_WIDTH, HEADER_HEIGHT, PORT_ROW_HEIGHT, HANDLE_SIZE, genId } from "@/lib/flow-utils";
import { buildNodeDefaults } from "@/lib/node-def";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

const nodeTypes = { typed: TypedNode } as any;

function makeNode(kind: NodeKind, position: { x: number; y: number }, title?: string, requiredInputType?: PortType): Node<TypedNodeData> {
  const defaults = buildNodeDefaults(kind, requiredInputType);
  return {
    id: genId("n"),
    type: "typed",
    position,
    data: { 
      title: title ?? getNodeTitle(kind),
      kind,
      inputs: defaults.inputs,
      outputs: defaults.outputs,
      llm: defaults.llm,
      values: defaults.values,
    },
  };
}


export default function FlowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const initialNodes = useMemo<Node<TypedNodeData>[]>(
    () => [],
    []
  );
  
  const [flowTitle, setFlowTitle] = useState<string>("Flow");
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<Node<TypedNodeData>, Edge> | null>(null);
  const [loadedFromServer, setLoadedFromServer] = useState<boolean>(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Track mouse position to place nodes at cursor when palette is used normally
  const [lastMousePos, setLastMousePos] = useState<{ x: number; y: number } | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TypedNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const { theme } = useTheme();
  const router = useRouter();

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // When interacting with the canvas (dragging/panning/selection), disable text selection globally
  const [canvasInteracting, setCanvasInteracting] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const latestPayloadRef = useRef<any>(null);
  // Cache of latest outputs by node id to avoid async state races during chained runs
  const runtimeOutputsRef = useRef<Record<string, Record<string, any>>>({});
  const retryTimerRef = useRef<number | null>(null);
  const backoffRef = useRef<number>(1000); // start at 1s, max 30s
  // History for undo/redo
  const historyRef = useRef<{ nodes: Node<TypedNodeData>[], edges: Edge[] }[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isRestoringRef = useRef<boolean>(false);
  const clipboardRef = useRef<{ nodes: Node<TypedNodeData>[]; edges: Edge[] } | null>(null);

  function clearRetry() {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }

  function scheduleRetry() {
    clearRetry();
    const delay = backoffRef.current;
    retryTimerRef.current = window.setTimeout(() => {
      if (latestPayloadRef.current) {
        attemptSave(latestPayloadRef.current, true);
      }
    }, delay) as unknown as number;
    backoffRef.current = Math.min(backoffRef.current * 2, 30000);
  }

  async function attemptSave(payload: any, isRetry = false) {
    setSaveStatus('saving');
    try {
      await api.saveFlowState(id, payload);
      setSaveStatus('saved');
      backoffRef.current = 1000;
      clearRetry();
    } catch (e) {
      setSaveStatus('error');
      if (!isRetry) {
        toast.error('Failed to save flow');
      }
      scheduleRetry();
    }
  }
  
  // State for tracking drag-to-create functionality
  const [pendingConnection, setPendingConnection] = useState<{
    nodeId: string;
    handleId: string;
    handleType: 'source' | 'target';
    portType: PortType;
    position: { x: number; y: number };
  } | null>(null);

  // State for drag-to-add-input functionality
  type DragState = {
    isDragging: boolean;
    portType: PortType | null;
    sourceNodeId: string | null;
    handleId: string | null;
  } | null;
  const [dragState, setDragState] = useState<DragState>(null);

  const selectedNode = useMemo(() => nodes.find((n: Node<TypedNodeData>) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);
  

  // Fetch flow name for topbar and initialize demo schemas
  useEffect(() => {
    let active = true;
        
    api
      .getFlow(id)
      .then((f) => {
        if (active) setFlowTitle(f.name);
      })
      .catch(() => setFlowTitle(`Flow ${id.slice(0, 6)}`));
    return () => {
      active = false;
    };
  }, [id]);

  // Load saved graph state (nodes/edges)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const state = await api.getFlowState(id);
        if (cancelled) return;
        const sNodes = (state.data?.nodes ?? []) as Node<TypedNodeData>[];
        const sEdges = (state.data?.edges ?? []) as Edge[];
        if (sNodes.length || sEdges.length) {
          setNodes(sNodes);
          setEdges(sEdges);
        }
      } catch (e) {
        // ignore; use defaults
      } finally {
        if (!cancelled) setLoadedFromServer(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, setNodes, setEdges]);

  // Listen for add-input-port events from nodes
  useEffect(() => {
    function handleAddInputPort(event: any) {
      const { targetNodeId, portType, sourceNodeId, sourceHandleId, dropzoneId } = event.detail;
      // Find the target node and add a new input port using the dropzone ID
      setNodes((currentNodes: Node<TypedNodeData>[]) => {
        return currentNodes.map((node: Node<TypedNodeData>) => {
          if (node.id === targetNodeId) {
            // Do not allow adding inputs to the global input node
            if (node.data.kind === 'input') return node;
            const newPort: Port = {
              id: dropzoneId,
              name: `input-${(node.data.inputs?.length ?? 0) + 1}`,
              type: portType,
              description: "",
            };
            
            
            return {
              ...node,
              data: {
                ...node.data,
                inputs: [...(node.data.inputs || []), newPort]
              }
            };
          }
          return node;
        });
      });
      
      // Create the connection after adding the port
      setTimeout(() => {
        setNodes((currentNodes: Node<TypedNodeData>[]) => {
          const targetNode = currentNodes.find((n: Node<TypedNodeData>) => n.id === targetNodeId);
          if (targetNode) {
            const newInputPort = targetNode.data.inputs?.[targetNode.data.inputs.length - 1];
            if (newInputPort) {
              const newConnection = {
                source: sourceNodeId,
                sourceHandle: sourceHandleId,
                target: targetNodeId,
                targetHandle: `in-${newInputPort.id}`,
              };
      setEdges((eds: Edge[]) => addEdge({ ...newConnection, style: edgeStyleForType(portType as PortType) }, eds));
            }
          }
          return currentNodes;
        });
      }, 10);
      
      // Clear the drag state
      setDragState(null);
      window.dispatchEvent(new CustomEvent('update-node-internals', { detail: { id: targetNodeId } }));
    }
    
    window.addEventListener('add-input-port', handleAddInputPort);
    return () => window.removeEventListener('add-input-port', handleAddInputPort);
  }, [setNodes, setEdges]);

  // Track global mouse position for placing nodes from the palette
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);



  // (moved to lib/flow-utils) portTypeForHandle

  const isValidConnection = useCallback(
    (c: Connection | Edge) => {
      // Allow preview for reverse drags; finalize onConnect
      if (!c.source || !c.sourceHandle || !c.target || !c.targetHandle) return true;
      if (c.source === c.target) return false;
      const srcNode = nodes.find((n: Node<TypedNodeData>) => n.id === c.source);
      const tgtNode = nodes.find((n: Node<TypedNodeData>) => n.id === c.target);
      const t1 = portTypeForHandle(srcNode as any, c.sourceHandle);
      const t2 = portTypeForHandle(tgtNode as any, c.targetHandle);
      if (!t1 || !t2) return true;
      return t1 === t2;
    },
    [nodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source) return;
      const src = nodes.find((n: Node<TypedNodeData>) => n.id === connection.source);
      const pt = portTypeForHandle(src as any, connection.sourceHandle);
      setEdges((eds: Edge[]) => addEdge({ ...connection, style: edgeStyleForType(pt || undefined) }, eds));
    },
    [setEdges, nodes]
  );

  const onConnectStart: OnConnectStart = useCallback((_: any, { nodeId, handleId, handleType }: any) => {
    if (!nodeId || !handleId || !handleType) return;
    
    const src = nodes.find((n: Node<TypedNodeData>) => n.id === nodeId);
    const portType = portTypeForHandle(src as any, handleId);
    if (!portType) return;
    
    // Store connection info for potential drag-to-create
    setPendingConnection({
      nodeId,
      handleId,
      handleType,
      portType,
      position: { x: 0, y: 0 },
    });

    // Also set drag state for drag-to-add-input functionality
    // Only track output port drags (sources) for adding inputs to other nodes
    if (handleType === 'source') {
      const newDragState = {
        isDragging: true,
        portType,
        sourceNodeId: nodeId,
        handleId,
      };
      setDragState(newDragState);
      
      // Dispatch event to notify all nodes
      window.dispatchEvent(new CustomEvent('drag-state-change', {
        detail: newDragState
      }));
    }
  }, [nodes]);

  const onConnectEnd: OnConnectEnd = useCallback((event: any) => {
    if (!event || !event.target || !pendingConnection) {
      setPendingConnection(null);
      // Only clear drag state if there's no pending connection
      setDragState(null);
      window.dispatchEvent(new CustomEvent('drag-state-change', { detail: null }));
      return;
    }
    
    // Check if the connection was dropped on empty space
    const target = event.target as Element;
    const isOnPane = target.classList.contains('react-flow__pane');
    
    if (isOnPane && rfInstance) {
      // Get the mouse position in flow coordinates
      const rect = (event.target as Element).getBoundingClientRect();
      const position = rfInstance.screenToFlowPosition({
        x: (event as MouseEvent).clientX - rect.left,
        y: (event as MouseEvent).clientY - rect.top,
      });
      
      // Update the pending connection with the drop position
      setPendingConnection(prev => prev ? { ...prev, position } : null);
      // If dragging from a target 'llm' input, auto-create an LLM provider node
      if (pendingConnection?.handleType === 'target' && pendingConnection?.portType === 'llm') {
        addNodeWithConnection('llm', position, pendingConnection);
        setPendingConnection(null);
        // Keep drag state cleanup consistent
        setDragState(null);
        window.dispatchEvent(new CustomEvent('drag-state-change', { detail: null }));
      } else {
        setPaletteOpen(true);
      }
      // Don't clear drag state here - keep it for potential drop zone clicks
    } else {
      // Connection was dropped on a valid target - clear everything
      setPendingConnection(null);
      setDragState(null);
      window.dispatchEvent(new CustomEvent('drag-state-change', { detail: null }));
    }
  }, [rfInstance, pendingConnection]);

  // Keep derived connectivity flags on nodes in sync with edges
  useEffect(() => {
    setNodes((curr: Node<TypedNodeData>[]) => {
      let changed = false;
      const next = curr.map((n: Node<TypedNodeData>) => {
        const inputsById: Record<string, boolean> = {};
        const inputsByName: Record<string, boolean> = {};
        for (const p of n.data.inputs || []) {
          const wired = edges.some((e: Edge) => e.target === n.id && e.targetHandle === `in-${p.id}`);
          inputsById[p.id] = wired;
          inputsByName[p.name] = wired;
        }
        const llmPort = n.data.inputs.find((p: Port) => p.type === 'llm' && p.name === 'model');
        const llmWired = !!(llmPort && inputsById[llmPort.id]);
        const prev = n.data.connected?.inputsById || {};
        const prevName = n.data.connected?.inputsByName || {};
        const eqIds = Object.keys(inputsById).length === Object.keys(prev).length && Object.keys(inputsById).every(k => prev[k] === inputsById[k]);
        const eqNames = Object.keys(inputsByName).length === Object.keys(prevName).length && Object.keys(inputsByName).every(k => prevName[k] === inputsByName[k]);
        const llmChanged = (n.data as any).llmConnected !== llmWired;
        if (!eqIds || !eqNames || llmChanged) {
          changed = true;
          return { ...n, data: { ...n.data, llmConnected: llmWired, connected: { inputsById, inputsByName } } };
        }
        return n;
      });
      return changed ? next : curr;
    });
  }, [edges, setNodes]);

  // Listen for node data updates from node components
  useEffect(() => {
    function onUpdateNodeData(ev: any) {
      const { nodeId, patch } = ev.detail || {};
      if (!nodeId || !patch) return;
      const prev = nodes.find((n: Node<TypedNodeData>) => n.id === nodeId);
      if (prev) {
        const nextData = { ...prev.data, ...patch } as TypedNodeData;
        const changed = hasNodeConfigChange(prev.data, nextData);
        if (changed && prev.data.runtime?.status === 'done') {
          clearDownstream(nodeId, true);
        }
      }
      setNodes((curr: Node<TypedNodeData>[]) => curr.map((n: Node<TypedNodeData>) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)));
    }
    window.addEventListener('update-node-data', onUpdateNodeData as any);
    return () => window.removeEventListener('update-node-data', onUpdateNodeData as any);
  }, [setNodes, nodes]);

  // Resolve values for a node's inputs
  function resolveInputsFor(node: Node<TypedNodeData>): { values: Record<string, any>; model?: string; error?: string } {
    const values: Record<string, any> = {};
    let model: string | undefined = undefined;
    // Determine model from wiring or local
    const modelPort = node.data.inputs.find((p: Port) => p.type === 'llm' && p.name === 'model');
    if (modelPort) {
      const edge = edges.find((e: Edge) => e.target === node.id && e.targetHandle === `in-${modelPort.id}`);
      if (edge) {
        const src = nodes.find((n: Node<TypedNodeData>) => n.id === edge.source);
        if (src) model = src.data.llm?.model;
      } else {
        model = node.data.llm?.model;
      }
    }
    for (const p of node.data.inputs) {
      if (p.type === 'llm' && p.name === 'model') continue;
      if (p.type === 'tool') continue; // special multi-input handled separately
      // find incoming
      const edge = edges.find((e: Edge) => e.target === node.id && e.targetHandle === `in-${p.id}`);
      if (edge) {
        const srcNode = nodes.find((n: Node<TypedNodeData>) => n.id === edge.source);
        if (!srcNode) return { values, model, error: `Missing source node for ${p.name}` };
        const srcPortId = (edge.sourceHandle || '').replace('out-', '');
        const srcPort = srcNode.data.outputs.find((op: Port) => op.id === srcPortId);
        const srcName = srcPort?.name || '';
        let v: any = undefined;
        if (srcNode.data.kind === 'input') {
          v = srcNode.data.values?.[srcName];
        } else {
          const cached = runtimeOutputsRef.current[srcNode.id]?.[srcName];
          v = cached !== undefined ? cached : srcNode.data.runtime?.outputs?.[srcName];
        }
        if (v === undefined || v === null) return { values, model, error: `Upstream value for ${p.name} not available` };
        values[p.name] = v;
      } else {
        // manual value if provided on node
        const v = node.data.values?.[p.name];
        if (v === undefined || v === null || v === '') {
          return { values, model, error: `Input ${p.name} is not connected and has no value` };
        }
        values[p.name] = v;
      }
    }
    return { values, model };
  }

  // Build list of tool function sources from all edges into the special 'tools' input
  function collectToolsForNode(node: Node<TypedNodeData>): { codes: string[]; error?: string } {
    if (node.data.kind !== 'agent') return { codes: [] };
    const toolsPort = node.data.inputs.find((p: Port) => p.type === 'tool' && p.name === 'tools');
    if (!toolsPort) return { codes: [] };
    const incoming = edges.filter((e: Edge) => e.target === node.id && e.targetHandle === `in-${toolsPort.id}`);
    const codes: string[] = [];
    for (const e of incoming) {
      const src = nodes.find((n: Node<TypedNodeData>) => n.id === e.source);
      if (!src) return { codes, error: 'Missing tool source node' };
      if (src.data.kind === 'tool_wikipedia') {
        codes.push(
          `def search_wikipedia(query: str):\n    results = dspy.ColBERTv2(url=\"http://20.102.90.50:2017/wiki17_abstracts\")(query, k=3)\n    return [x[\"text\"] for x in results]\n`
        );
      } else if (src.data.kind === 'tool_math') {
        codes.push(
          `def evaluate_math(expression: str):\n    return dspy.PythonInterpreter({}).execute(expression)\n`
        );
      } else if (src.data.kind === 'tool_python') {
        const code = src.data.values?.code || '';
        if (!code.trim()) return { codes, error: 'Custom Python tool has empty code' };
        codes.push(code);
      } else {
        return { codes, error: `Unsupported tool node: ${src.data.kind}` };
      }
    }
    return { codes };
  }

  function getToolNodeIdsForAgent(node: Node<TypedNodeData>): string[] {
    if (node.data.kind !== 'agent') return [];
    const toolsPort = node.data.inputs.find(p => p.type === 'tool' && p.name === 'tools');
    if (!toolsPort) return [];
    const incoming = edges.filter(e => e.target === node.id && e.targetHandle === `in-${toolsPort.id}`);
    const ids: string[] = [];
    for (const e of incoming) {
      const src = nodes.find(n => n.id === e.source);
      if (src) ids.push(src.id);
    }
    return ids;
  }

  async function runNode(nodeId: string) {
    const node = nodes.find((n: Node<TypedNodeData>) => n.id === nodeId);
    if (!node) return;
    // set running
    setNodes((curr: Node<TypedNodeData>[]) => curr.map((n: Node<TypedNodeData>) => n.id === nodeId ? { ...n, data: { ...n.data, runtime: { ...(n.data.runtime || {}), status: 'running', error: undefined } } } : n));

    // If this is an agent, clear any previous tool-node highlights before the new run
    if (node.data.kind === 'agent') {
      const toolIds = getToolNodeIdsForAgent(node);
      if (toolIds.length) {
        setNodes((curr: Node<TypedNodeData>[]) => curr.map((n: Node<TypedNodeData>) => {
          if (!toolIds.includes(n.id)) return n;
          if (n.data.runtime) return { ...n, data: { ...n.data, runtime: undefined } } as Node<TypedNodeData>;
          return n;
        }));
      }
    }

    const resolution = resolveInputsFor(node);
    if (resolution.error) {
      setNodes((curr: Node<TypedNodeData>[]) => curr.map((n: Node<TypedNodeData>) => n.id === nodeId ? { ...n, data: { ...n.data, runtime: { status: 'error', error: resolution.error } } } : n));
      toast.error(resolution.error);
      return;
    }

    const inputsSchema = node.data.inputs
      .filter((p: Port) => !(p.type === 'llm' && p.name === 'model'))
      .filter((p: Port) => p.type !== 'tool')
      .map((p: Port) => ({ name: p.name, type: p.type, description: p.description }));
    const outputsSchema = node.data.outputs.map((p: Port) => ({ name: p.name, type: p.type, description: p.description }));

    try {
      let tools_code: string[] | undefined = undefined;
      if (node.data.kind === 'agent') {
        const collected = collectToolsForNode(node);
        if (collected.error) {
          setNodes(curr => curr.map(n => n.id === nodeId ? { ...n, data: { ...n.data, runtime: { status: 'error', error: collected.error } } } : n));
          toast.error(collected.error);
          return;
        }
        tools_code = collected.codes;
      }

      // Prefer streaming endpoint for live updates
      const resp = await api.runNodeStream(id, {
        node_id: nodeId,
        node_kind: node.data.kind,
        node_title: node.data.title,
        node_description: node.data.description,
        inputs_schema: inputsSchema as any,
        outputs_schema: outputsSchema as any,
        inputs_values: resolution.values,
        model: resolution.model,
        lm_params: node.data.llm ? { temperature: node.data.llm.temperature, top_p: node.data.llm.top_p, max_tokens: node.data.llm.max_tokens } : undefined,
        tools_code,
      });

      if (!resp.ok || !resp.body) {
        // Fallback to non-streaming if response not streamable
        const res = await api.runNode(id, {
          node_kind: node.data.kind,
          node_title: node.data.title,
          node_description: node.data.description,
          inputs_schema: inputsSchema as any,
          outputs_schema: outputsSchema as any,
          inputs_values: resolution.values,
          model: resolution.model,
          lm_params: node.data.llm ? { temperature: node.data.llm.temperature, top_p: node.data.llm.top_p, max_tokens: node.data.llm.max_tokens } : undefined,
          tools_code,
        });
        if (res.error) {
          setNodes(curr => curr.map(n => n.id === nodeId ? { ...n, data: { ...n.data, runtime: { status: 'error', error: res.error } } } : n));
          toast.error(res.error);
          return;
        }
        runtimeOutputsRef.current[nodeId] = res.outputs || {};
        setNodes(curr => curr.map(n => n.id === nodeId ? { ...n, data: { ...n.data, runtime: { status: 'done', outputs: res.outputs } } } : n));
        clearDownstream(nodeId, false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalOutputs: Record<string, any> | null = null;
      let finalError: string | null = null;
      let sawTerminal = false;

      function appendEvent(ev: any) {
        const nowTs = Date.now();
        setNodes(curr => {
          const next = curr.map(n => {
            // Always record event on the compute node for history
            if (n.id === nodeId) {
              const rt = n.data.runtime || {};
              const events = [...(rt.events || [])];
              events.push({ ts: ev.ts || nowTs, ...ev });
              let current = rt.current || null;
              if (ev.event === 'run_start') current = { kind: 'run', label: 'starting', startedAt: ev.ts || nowTs } as any;
              if (ev.event === 'lm_start') current = { kind: 'lm', label: 'prompting', startedAt: ev.ts || nowTs } as any;
              if (ev.event === 'module_start') current = { kind: 'module', label: 'running module', startedAt: ev.ts || nowTs } as any;
              // For tool steps, we do not set compute node color by step; keep generic running
              if (ev.event === 'tool_start') current = { kind: 'run', label: 'using tool', startedAt: ev.ts || nowTs } as any;
              return { ...n, data: { ...n.data, runtime: { ...(rt), status: 'running' as const, events, current } } };
            }
            return n;
          });

          // Additionally, highlight the actual tool node when tool events occur
          if (ev.event === 'tool_start' || ev.event === 'tool_end') {
            const tIndex: number | undefined = ev.tool_index;
            if (typeof tIndex === 'number') {
              // Find compute node and its tools input
              const comp = next.find(nn => nn.id === nodeId);
              if (comp) {
                const toolsPort = comp.data.inputs.find(p => p.type === 'tool' && p.name === 'tools');
                if (toolsPort) {
                  const incoming = edges.filter(e => e.target === comp.id && e.targetHandle === `in-${toolsPort.id}`);
                  const edge = incoming[tIndex];
                  if (edge) {
                    const srcId = edge.source;
                    for (let i = 0; i < next.length; i++) {
                      if (next[i].id === srcId) {
                        const rt = next[i].data.runtime || {};
                        if (ev.event === 'tool_start') {
                          next[i] = { ...next[i], data: { ...next[i].data, runtime: { ...(rt), status: 'running', current: { kind: 'run', label: ev.tool || 'tool', startedAt: ev.ts || nowTs } } } } as any;
                        } else {
                          const isErr = !!ev.exception;
                          next[i] = { ...next[i], data: { ...next[i].data, runtime: { status: isErr ? 'error' : 'done', error: isErr ? String(ev.exception) : undefined } } } as any;
                        }
                        break;
                      }
                    }
                  }
                }
              }
            }
          }

          return next;
        });
      }

      // Read loop
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            const ev = JSON.parse(line);
            const t = ev?.event;
            if (t === 'result') {
              finalOutputs = ev.outputs || {};
              sawTerminal = true;
            } else if (t === 'error') {
              finalError = ev.message || 'Run failed';
              sawTerminal = true;
            }
            appendEvent(ev);
          } catch (e) {
            // ignore parse errors for individual lines
          }
        }
      }

      if (finalError) {
        setNodes(curr => curr.map(n => n.id === nodeId ? { ...n, data: { ...n.data, runtime: { status: 'error', error: finalError } } } : n));
        toast.error(finalError);
        return;
      }

      // If stream ended without a terminal event, treat as error
      if (!sawTerminal && !finalOutputs) {
        const msg = 'Stream ended unexpectedly';
        setNodes(curr => curr.map(n => n.id === nodeId ? { ...n, data: { ...n.data, runtime: { status: 'error', error: msg } } } : n));
        toast.error(msg);
        return;
      }

      const outputs = finalOutputs || {};
      runtimeOutputsRef.current[nodeId] = outputs;
      setNodes(curr => curr.map(n => n.id === nodeId ? { ...n, data: { ...n.data, runtime: { status: 'done', outputs, current: null } } } : n));
      clearDownstream(nodeId, false);
    } catch (e: any) {
      const msg = e?.message || 'Run failed';
      setNodes(curr => curr.map(n => n.id === nodeId ? { ...n, data: { ...n.data, runtime: { status: 'error', error: msg } } } : n));
      toast.error(msg);
    }
  }

  function getOutgoing(nodeId: string) {
    return edges.filter(e => e.source === nodeId);
  }

  function isComputeNodeKind(kind: NodeKind) {
    return kind === 'predict' || kind === 'chainofthought' || kind === 'agent';
  }

  function collectDownstream(nodeId: string): Set<string> {
    const visited = new Set<string>();
    const queue: string[] = [];
    getOutgoing(nodeId).forEach(e => queue.push(e.target));
    while (queue.length) {
      const nid = queue.shift()!;
      if (visited.has(nid)) continue;
      visited.add(nid);
      getOutgoing(nid).forEach(e => queue.push(e.target));
    }
    return visited;
  }

  function clearDownstream(nodeId: string, includeCurrent: boolean) {
    const affected = collectDownstream(nodeId);
    if (includeCurrent) affected.add(nodeId);
    setNodes(curr => curr.map(n => {
      if (!affected.has(n.id)) return n;
      // Only clear compute nodes; output nodes are derived previews
      if (!isComputeNodeKind(n.data.kind)) return n;
      const st = n.data.runtime?.status;
      if (st === 'done' || st === 'error' || st === 'running' || n.data.runtime) {
        return { ...n, data: { ...n.data, runtime: undefined } };
      }
      return n;
    }));
    // Clear cached outputs for affected compute nodes
    affected.forEach(nid => {
      delete runtimeOutputsRef.current[nid];
    });
  }

  async function runWithDeps(nodeId: string, executed: Set<string>, force: boolean = false) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    // First, ensure all upstream dependencies are run
    for (const p of node.data.inputs) {
      if (p.type === 'llm' && p.name === 'model') continue;
      const edge = edges.find(e => e.target === node.id && e.targetHandle === `in-${p.id}`);
      if (!edge) continue; // manual or missing
      const src = nodes.find(n => n.id === edge.source);
      if (!src) continue;
      await runWithDeps(src.id, executed, force);
    }
    // Then, run this node if it's a compute node and not already executed in this batch
    if (isComputeNodeKind(node.data.kind) && !executed.has(node.id)) {
      const st = node.data.runtime?.status;
      if (!force && st === 'done') {
        return; // already fresh, skip
      }
      executed.add(node.id);
      await runNode(node.id);
    }
  }

  async function runToNode(nodeId: string) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const executed = new Set<string>();
    // Run prerequisites normally (reuse cache), then force-run the clicked node
    await runWithDeps(nodeId, executed, false);
    if (isComputeNodeKind(node.data.kind)) {
      await runNode(nodeId);
    }
  }

  async function runAll() {
    // Reset compute nodes' runtime to show a fresh pass
    setNodes(curr => curr.map(n => {
      if (isComputeNodeKind(n.data.kind)) {
        return { ...n, data: { ...n.data, runtime: undefined } };
      }
      return n;
    }));
    // Clear all cached outputs
    runtimeOutputsRef.current = {};

    // Allow React to apply the clear before starting execution
    await new Promise<void>((resolve) => {
      // next microtask + paint
      setTimeout(() => resolve(), 0);
    });

    // Execute all compute nodes reachable in the graph, ensuring prerequisites run first (force fresh)
    const executed = new Set<string>();
    const outputs = nodes.filter(n => n.data.kind === 'output');
    if (outputs.length > 0) {
      for (const out of outputs) {
        await runWithDeps(out.id, executed, true);
      }
    } else {
      // No explicit outputs; run all compute nodes
      const computes = nodes.filter(n => isComputeNodeKind(n.data.kind));
      for (const c of computes) {
        await runWithDeps(c.id, executed, true);
      }
    }
  }

  const onSelectionChange = useCallback(({ nodes: n, edges: e }: { nodes: Node[], edges: Edge[] }) => {
    setSelectedNodeId(n[0]?.id ?? null);
    setSelectedEdgeId(e[0]?.id ?? null);
  }, []);

  function hasNodeConfigChange(prev: TypedNodeData, next: TypedNodeData) {
    if (prev.title !== next.title) return true;
    if ((prev.description || '') !== (next.description || '')) return true;
    const a = prev.inputs || [];
    const b = next.inputs || [];
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
      const pa = a[i];
      const pb = b[i];
      if (pa.name !== pb.name) return true;
      if (pa.type !== pb.type) return true;
      if ((pa.description || '') !== (pb.description || '')) return true;
    }
    return false;
  }

  function updateSelectedNode(data: TypedNodeData) {
    if (!selectedNodeId) return;
    
    const prev = nodes.find(n => n.id === selectedNodeId);
    const changed = prev ? hasNodeConfigChange(prev.data, data) : false;
    if (changed && prev && prev.data.runtime?.status === 'done') {
      // Clear current compute node and downstream
      clearDownstream(selectedNodeId, true);
      // If this is an agent, also clear connected tool nodes' highlights
      if (prev.data.kind === 'agent') {
        const toolIds = getToolNodeIdsForAgent(prev);
        if (toolIds.length) {
          setNodes((curr: Node<TypedNodeData>[]) => curr.map((n: Node<TypedNodeData>) => toolIds.includes(n.id) ? { ...n, data: { ...n.data, runtime: undefined } } : n));
        }
      }
    }
    setNodes((ns) => ns.map((n) => (n.id === selectedNodeId ? { ...n, data } : n)));
  }

  function addPort(direction: "inputs" | "outputs") {
    if (!selectedNode) return;
    // Respect node kind constraints
    if (selectedNode.data.kind === 'input' && direction === 'inputs') return;
    if (selectedNode.data.kind === 'output' && direction === 'outputs') return;
    const newPort: Port = {
      id: genId("p"),
      name: `${direction === "inputs" ? "in" : "out"}-${(selectedNode.data[direction]?.length ?? 0) + 1}`,
      type: "string",
      description: "",
    };
    const next = { ...selectedNode.data, [direction]: [...(selectedNode.data[direction] || []), newPort] } as TypedNodeData;
    updateSelectedNode(next);
  }

  // Palette and quick add
  function addNodeAtCenter(kind: NodeKind) {
    const labelForKind = (k: NodeKind) => getNodeTitle(k);
    // Prefer placing at cursor if available, otherwise center
    let pos = undefined as { x: number; y: number } | undefined;
    if (lastMousePos && rfInstance) {
      pos = rfInstance.screenToFlowPosition({ x: lastMousePos.x, y: lastMousePos.y });
    }
    if (!pos) {
      const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 - 24 /* under topbar */ };
      pos = rfInstance?.screenToFlowPosition(center) ?? { x: center.x, y: center.y };
    }
    if (kind === 'input' && nodes.some(n => n.data.kind === 'input')) {
      return;
    }
    const node = makeNode(kind, pos, labelForKind(kind));
    setNodes((ns) => ns.concat(node));
  }

  function addNodeWithConnection(kind: NodeKind, position: { x: number; y: number }, connection: {
    nodeId: string;
    handleId: string;
    handleType: 'source' | 'target';
    portType: PortType;
  }) {
    if (kind === 'input' && nodes.some(n => n.data.kind === 'input')) {
      return;
    }
    // Calculate offset position so the handle aligns with the drop point
    const offsetPosition = calculateOffsetPosition(position, connection, kind);
    
    // Create node with appropriate input type if connecting from a source
    const requiredType = connection.handleType === 'source' ? connection.portType : undefined;
    const labelForKind = (k: NodeKind) => getNodeTitle(k);
    const node = makeNode(kind, offsetPosition, labelForKind(kind), requiredType);
    
    // Add the node first
    setNodes((ns) => ns.concat(node));
    
    // Create the connection using the nodes state update callback to ensure we have the latest nodes
    setNodes((currentNodes) => {
      // Find a compatible port on the new node
      let compatiblePort: Port | null = null;
      
      if (connection.handleType === 'source') {
        // Connection is from an output port, so we need to find an input port on the new node
        compatiblePort = node.data.inputs.find(p => p.type === connection.portType) || null;
      } else {
        // Connection is from an input port, so we need to find an output port on the new node
        compatiblePort = node.data.outputs.find(p => p.type === connection.portType) || null;
      }
      
      if (compatiblePort) {
        const newConnection: Connection = connection.handleType === 'source' 
          ? {
              source: connection.nodeId,
              sourceHandle: connection.handleId,
              target: node.id,
              targetHandle: `in-${compatiblePort.id}`,
            }
          : {
              source: node.id,
              sourceHandle: `out-${compatiblePort.id}`,
              target: connection.nodeId,
              targetHandle: connection.handleId,
            };
        
        // Manual validation with current nodes instead of relying on isValidConnection closure
        const sourceNode = currentNodes.find(n => n.id === newConnection.source);
        const targetNode = currentNodes.find(n => n.id === newConnection.target);
        
        if (sourceNode && targetNode && newConnection.source !== newConnection.target) {
          const sourcePortType = portTypeForHandle(sourceNode as any, newConnection.sourceHandle);
          const targetPortType = portTypeForHandle(targetNode as any, newConnection.targetHandle);
          if (sourcePortType && targetPortType && sourcePortType === targetPortType) {
            setTimeout(() => {
              setEdges((eds) => addEdge({ ...newConnection, style: edgeStyleForType(connection.portType) }, eds));
            }, 10);
          }
        }
      }
      
      return currentNodes; // Return unchanged nodes array
    });
  }

  function calculateOffsetPosition(dropPosition: { x: number; y: number }, connection: {
    handleType: 'source' | 'target';
    portType: PortType;
  }, kind: NodeKind): { x: number; y: number } {
    // Node dimensions from TypedNode.tsx
    const nodeWidth = NODE_WIDTH;
    const headerHeight = HEADER_HEIGHT;
    const contentPaddingTop = 12; // p-3 top
    const portSpacing = PORT_ROW_HEIGHT;
    const handleSize = HANDLE_SIZE;
    
    // Calculate handle position relative to node
    const portIndex = 0; // We'll connect to the first compatible port
    const handleTop = headerHeight + contentPaddingTop + (portIndex * portSpacing) + (portSpacing / 2);
    
    if (connection.handleType === 'source') {
      // We're creating an input connection, so offset to align the left handle (input) with drop point
      return {
        x: dropPosition.x + handleSize / 2, // Offset by half handle size
        y: dropPosition.y - handleTop
      };
    } else {
      // We're creating an output connection, so offset to align the right handle (output) with drop point
      return {
        x: dropPosition.x - nodeWidth - handleSize / 2,
        y: dropPosition.y - handleTop
      };
    }
  }

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const typing = tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable;
      if (e.shiftKey && (e.key === "A" || e.key === "a") && !typing) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  function removePort(direction: "inputs" | "outputs", portId: string) {
    if (!selectedNode) return;
    // Respect node kind constraints
    if (selectedNode.data.kind === 'input' && direction === 'inputs') return;
    if (selectedNode.data.kind === 'output' && direction === 'outputs') return;
    
    // Don't allow removal of reasoning port from chainofthought nodes
    if (selectedNode.data.kind === "chainofthought" && direction === "outputs") {
      const portToRemove = selectedNode.data[direction]?.find(p => p.id === portId);
      if (portToRemove?.name === "reasoning") {
        return; // Silently prevent removal
      }
    }
    
    const next = { ...selectedNode.data, [direction]: (selectedNode.data[direction] || []).filter((p) => p.id !== portId) } as TypedNodeData;
    updateSelectedNode(next);
  }

  // Edge validation feedback: turn incompatible edges red
  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => {
        const n1 = nodes.find((n) => n.id === e.source);
        const n2 = nodes.find((n) => n.id === e.target);
        const t1 = portTypeForHandle(n1 as any, e.sourceHandle);
        const t2 = portTypeForHandle(n2 as any, e.targetHandle);
        const incompatible = !!t1 && !!t2 && t1 !== t2;
        const stroke = incompatible ? "#ef4444" /* red-500 */ : undefined;
        const style = stroke ? { ...(e.style || {}), stroke } : { ...(e.style || {}) };
        // Avoid churn if style unchanged
        const hasStroke = (e.style as any)?.stroke;
        if ((stroke && hasStroke !== stroke) || (!stroke && hasStroke)) {
          return { ...e, style } as Edge;
        }
        return e;
      })
    );
  }, [nodes, setEdges]);

  // Apply outline effect to selected edges
  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => {
        const isSelected = e.id === selectedEdgeId;
        const currentStyle = e.style || {};
        
        if (isSelected) {
          // Add outline effect for selected edge
          return {
            ...e,
            style: {
              ...currentStyle,
              filter: 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.8))',
              strokeWidth: (typeof currentStyle.strokeWidth === 'number' ? currentStyle.strokeWidth : 3) + 1,
            }
          } as Edge;
        } else {
          // Remove outline effect from non-selected edges
          const { filter, ...restStyle } = currentStyle;
          const strokeWidth = typeof currentStyle.strokeWidth === 'number' && currentStyle.strokeWidth > 3 
            ? currentStyle.strokeWidth - 1 
            : currentStyle.strokeWidth;
          
          return {
            ...e,
            style: {
              ...restStyle,
              strokeWidth,
            }
          } as Edge;
        }
      })
    );
  }, [selectedEdgeId, setEdges]);


  // Auto-save graph state when nodes/edges change (debounced)
  useEffect(() => {
    if (!loadedFromServer) return; // avoid saving before initial load
    const handle = setTimeout(() => {
      const payload = { nodes, edges } as any;
      latestPayloadRef.current = payload;
      clearRetry();
      backoffRef.current = 1000; // reset backoff on new change
      attemptSave(payload);
    }, 500);
    return () => clearTimeout(handle);
  }, [id, nodes, edges, rfInstance, loadedFromServer]);

  // Turn saved -> idle after a short delay
  useEffect(() => {
    if (saveStatus === 'saved') {
      const t = setTimeout(() => setSaveStatus('idle'), 1200);
      return () => clearTimeout(t);
    }
  }, [saveStatus]);

  // Prevent accidental refresh/close while saving
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [saveStatus]);

  // Push history snapshot when nodes/edges change
  useEffect(() => {
    if (isRestoringRef.current) return;
    const snapshot = { nodes, edges };
    const prev = historyRef.current[historyIndexRef.current];
    const same = prev && JSON.stringify(prev) === JSON.stringify(snapshot);
    if (same) return;
    // Truncate forward history if any
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }
    historyRef.current.push(snapshot);
    historyIndexRef.current++;
  }, [nodes, edges]);

  function undo() {
    if (historyIndexRef.current <= 0) return;
    isRestoringRef.current = true;
    historyIndexRef.current--;
    const snap = historyRef.current[historyIndexRef.current];
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setTimeout(() => { isRestoringRef.current = false; }, 0);
  }

  function redo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    isRestoringRef.current = true;
    historyIndexRef.current++;
    const snap = historyRef.current[historyIndexRef.current];
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setTimeout(() => { isRestoringRef.current = false; }, 0);
  }

  // Copy/paste handlers
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key.toLowerCase() === 'c') {
        // Copy
        if (selectedNodeIds.length === 0) return;
        const selNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
        const selEdges = edges.filter(e => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target));
        clipboardRef.current = { nodes: selNodes.map(n => ({ ...n })), edges: selEdges.map(e => ({ ...e })) };
      } else if (e.key.toLowerCase() === 'v') {
        // Paste
        if (!clipboardRef.current) return;
        e.preventDefault();
        const oldToNew: Record<string, string> = {};
        const offset = { x: 40, y: 40 };
        const newNodes = clipboardRef.current.nodes.map(n => {
          const newId = genId('n');
          oldToNew[n.id] = newId;
          return { ...n, id: newId, position: { x: n.position.x + offset.x, y: n.position.y + offset.y }, selected: true } as Node<TypedNodeData>;
        });
        const newEdges = clipboardRef.current.edges.map(e => ({
          ...e,
          id: genId('e'),
          source: oldToNew[e.source] || e.source,
          target: oldToNew[e.target] || e.target,
        }));
        // Deselect all existing nodes, then add new nodes as selected
        setNodes(ns => [...ns.map(n => ({ ...n, selected: false })), ...newNodes]);
        // Deselect all existing edges (don't auto-select new edges)
        setEdges(es => [...es.map(ed => ({ ...ed, selected: false })), ...newEdges]);
        setSelectedNodeIds(newNodes.map(n => n.id));
        setSelectedNodeId(newNodes[0]?.id ?? null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nodes, edges, selectedNodeIds]);

  // Enable select-none when starting a shift-drag inside the canvas to avoid browser text selection
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!e.shiftKey || e.button !== 0) return;
      const target = e.target as Element | null;
      if (!target) return;
      // Only engage when starting inside the React Flow pane
      if (target.closest('.react-flow')) {
        setCanvasInteracting(true);
      }
    }
    function onMouseUp() {
      if (canvasInteracting) setCanvasInteracting(false);
    }
    window.addEventListener('mousedown', onMouseDown, { capture: true });
    window.addEventListener('mouseup', onMouseUp, { capture: true });
    return () => {
      window.removeEventListener('mousedown', onMouseDown, { capture: true } as any);
      window.removeEventListener('mouseup', onMouseUp, { capture: true } as any);
    };
  }, [canvasInteracting]);

  return (
    <div ref={containerRef} className={`h-screen w-screen overflow-hidden bg-background ${canvasInteracting ? 'select-none' : ''}`}>
      <Topbar title={flowTitle} status={saveStatus} onBack={() => {
        if (saveStatus === 'saving') {
          const ok = confirm('A save is in progress. Are you sure you want to leave?');
          if (!ok) return;
        }
        router.push('/');
      }} onRunAll={runAll} flowId={id} onUndo={undo} onRedo={redo} canUndo={historyIndexRef.current > 0} canRedo={historyIndexRef.current < historyRef.current.length - 1} />
      <div className="absolute inset-0 top-14 flow-builder">
        <ReactFlow
          nodeTypes={nodeTypes}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          colorMode={theme as ColorMode}
          isValidConnection={isValidConnection}
          onSelectionChange={onSelectionChange}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(e, node) => {
            if (e.shiftKey) {
              e.preventDefault();
              e.stopPropagation();
              setNodes(curr => curr.map(n => n.id === node.id ? { ...n, selected: !n.selected } : n));
              setSelectedNodeIds(prev => {
                const has = prev.includes(node.id);
                const next = has ? prev.filter(id => id !== node.id) : [...prev, node.id];
                if (!has && !selectedNodeId) setSelectedNodeId(node.id);
                return next;
              });
            }
          }}
          onInit={(inst) => setRfInstance(inst)}
          onMoveStart={() => setCanvasInteracting(true)}
          onMoveEnd={() => setCanvasInteracting(false)}
          onPaneClick={() => setCanvasInteracting(false)}
          onPaneContextMenu={() => setCanvasInteracting(false)}
          onPaneScroll={() => setCanvasInteracting(false)}
          connectionLineComponent={CustomConnectionLine}
          elementsSelectable={true}
          selectionOnDrag={true}
          selectNodesOnDrag={true}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
      <div className="display: none;">{theme /* required to force a rerender on theme change for reactflow */}</div>

      <NodeInspector node={selectedNode ?? null} onChange={updateSelectedNode} onAddPort={addPort} onRemovePort={removePort} onRunNode={runToNode} flowId={id} finalOutputs={(() => {
        if (!selectedNode || selectedNode.data.kind !== 'output') return [];
        const res: { name: string; value: any }[] = [];
        for (const p of selectedNode.data.inputs) {
          const e = edges.find(ed => ed.target === selectedNode.id && ed.targetHandle === `in-${p.id}`);
          if (!e) {
            res.push({ name: p.name, value: undefined });
            continue;
          }
          const src = nodes.find(n => n.id === e.source);
          if (!src) {
            res.push({ name: p.name, value: undefined });
            continue;
          }
          const srcPortId = (e.sourceHandle || '').replace('out-', '');
          const sp = src.data.outputs.find(op => op.id === srcPortId);
          const srcName = sp?.name || '';
          let v: any = undefined;
          if (src.data.kind === 'input') v = src.data.values?.[srcName];
          else v = src.data.runtime?.outputs?.[srcName];
          res.push({ name: p.name, value: v });
        }
        return res;
      })()} />
      <Palette 
        open={paletteOpen} 
        onClose={() => {
          setPaletteOpen(false);
          setPendingConnection(null);
          setDragState(null);
          window.dispatchEvent(new CustomEvent('drag-state-change', { detail: null }));
        }} 
        onChoose={(k) => {
          if (pendingConnection) {
            addNodeWithConnection(k, pendingConnection.position, pendingConnection);
            setPendingConnection(null);
          } else {
            addNodeAtCenter(k);
          }
          setDragState(null);
          window.dispatchEvent(new CustomEvent('drag-state-change', { detail: null }));
          setPaletteOpen(false);
        }}
        connectionContext={pendingConnection ? {
          portType: pendingConnection.portType,
          isFromOutput: pendingConnection.handleType === 'source'
        } : undefined}
        hiddenKinds={(() => {
          const hidden: NodeKind[] = [] as NodeKind[];
          if (nodes.some(n => n.data.kind === 'input')) hidden.push('input');
          if (nodes.some(n => n.data.kind === 'output')) hidden.push('output');
          return hidden;
        })()}
      />

      {/* Small FAB to open palette */}
      <button
        onClick={() => setPaletteOpen(true)}
        className="fixed bottom-5 left-5 z-40 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
      >
        Add Node (Shift+A)
      </button>
    </div>
  );
}
