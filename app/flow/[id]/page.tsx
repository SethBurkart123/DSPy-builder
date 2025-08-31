"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  Edge,
  Node,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import Topbar from "@/components/flowbuilder/Topbar";
import NodeInspector from "@/components/flowbuilder/NodeInspector";
import { TypedNode } from "@/components/flowbuilder/TypedNode";
import type { TypedNodeData, Port, NodeKind, PortType } from "@/components/flowbuilder/types";
import { api } from "@/lib/api";
import Palette from "@/components/flowbuilder/Palette";
import type { ReactFlowInstance } from "reactflow";

function genId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const nodeTypes = { typed: TypedNode } as const;

function makePort(name: string, type: PortType): Port {
  return { id: genId("p"), name, type };
}

function makeNode(kind: NodeKind, position: { x: number; y: number }, title?: string): Node<TypedNodeData> {
  let inputs: Port[] = [];
  let outputs: Port[] = [];
  if (kind === "chainofthought") {
    inputs = [makePort("prompt", "string")];
    outputs = [makePort("thought", "string")];
  } else if (kind === "classify") {
    inputs = [makePort("text", "string")];
    outputs = [makePort("label", "string")];
  }

  return {
    id: genId("n"),
    type: "typed",
    position,
    data: { title: title ?? kind, kind, inputs, outputs },
  };
}

export default function FlowBuilderPage({ params }: { params: { id: string } }) {
  const [flowTitle, setFlowTitle] = useState<string>("Flow");
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Fetch flow name for topbar
  useEffect(() => {
    let active = true;
    api
      .getFlow(params.id)
      .then((f) => {
        if (active) setFlowTitle(f.name);
      })
      .catch(() => setFlowTitle(`Flow ${params.id.slice(0, 6)}`));
    return () => {
      active = false;
    };
  }, [params.id]);

  const initialNodes = useMemo<Node<TypedNodeData>[]>(
    () => [
      makeNode("chainofthought", { x: 200, y: 200 }, "Chain Of Thought"),
      makeNode("classify", { x: 600, y: 220 }, "Classify"),
    ],
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<TypedNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);

  function portTypeFor(nodeId?: string | null, handleId?: string | null): PortType | null {
    if (!nodeId || !handleId) return null;
    const n = nodes.find((x) => x.id === nodeId);
    if (!n) return null;
    const pid = handleId.replace(/^in-|^out-/, "");
    const inp = n.data.inputs.find((p) => p.id === pid);
    if (inp) return inp.type;
    const outp = n.data.outputs.find((p) => p.id === pid);
    return outp ? outp.type : null;
  }

  const isValidConnection = useCallback(
    (c: Connection) => {
      if (!c.source || !c.sourceHandle || !c.target || !c.targetHandle) return false;
      // enforce direction out -> in
      if (!c.sourceHandle.startsWith("out-") || !c.targetHandle.startsWith("in-")) return false;
      if (c.source === c.target) return false; // disallow self
      const t1 = portTypeFor(c.source, c.sourceHandle);
      const t2 = portTypeFor(c.target, c.targetHandle);
      return !!t1 && t1 === t2;
    },
    [nodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return;
      setEdges((eds) => addEdge({ ...connection }, eds));
    },
    [isValidConnection, setEdges]
  );

  const onSelectionChange = useCallback(({ nodes: n }: { nodes: Node[] }) => {
    setSelectedNodeId(n[0]?.id ?? null);
  }, []);

  function updateSelectedNode(data: TypedNodeData) {
    if (!selectedNodeId) return;
    setNodes((ns) => ns.map((n) => (n.id === selectedNodeId ? { ...n, data } : n)));
  }

  function addPort(direction: "inputs" | "outputs") {
    if (!selectedNode) return;
    const newPort: Port = {
      id: genId("p"),
      name: `${direction === "inputs" ? "in" : "out"}-${(selectedNode.data[direction]?.length ?? 0) + 1}`,
      type: "string",
    };
    const next = { ...selectedNode.data, [direction]: [...(selectedNode.data[direction] || []), newPort] } as TypedNodeData;
    updateSelectedNode(next);
  }

  // Palette and quick add
  function addNodeAtCenter(kind: NodeKind) {
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 - 24 /* under topbar */ };
    const pos = rfInstance?.screenToFlowPosition(center) ?? { x: center.x, y: center.y };
    const node = makeNode(kind, pos);
    setNodes((ns) => ns.concat(node));
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
    const next = { ...selectedNode.data, [direction]: (selectedNode.data[direction] || []).filter((p) => p.id !== portId) } as TypedNodeData;
    updateSelectedNode(next);
  }

  // Edge validation feedback: turn incompatible edges red
  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => {
        const t1 = portTypeFor(e.source, e.sourceHandle);
        const t2 = portTypeFor(e.target, e.targetHandle);
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

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <Topbar title={flowTitle} />
      <div className="absolute inset-0 top-12">
        <ReactFlow
          nodeTypes={nodeTypes}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onSelectionChange={onSelectionChange}
          onInit={(inst) => setRfInstance(inst)}
          fitView
        >
          <Background variant="dots" gap={16} size={1} />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>

      <NodeInspector node={selectedNode ?? null} onChange={updateSelectedNode} onAddPort={addPort} onRemovePort={removePort} />
      <Palette open={paletteOpen} onClose={() => setPaletteOpen(false)} onChoose={(k) => { addNodeAtCenter(k); setPaletteOpen(false); }} />

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
