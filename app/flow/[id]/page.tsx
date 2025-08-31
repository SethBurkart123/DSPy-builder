"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
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
  BackgroundVariant,
  OnConnectStart,
  OnConnectEnd,
} from "reactflow";
import "reactflow/dist/style.css";

import Topbar from "@/components/flowbuilder/Topbar";
import NodeInspector from "@/components/flowbuilder/NodeInspector";
import { TypedNode, type DragState } from "@/components/flowbuilder/TypedNode";
import { CustomConnectionLine } from "@/components/flowbuilder/CustomConnectionLine";
import type { TypedNodeData, Port, NodeKind, PortType } from "@/components/flowbuilder/types";
import { PORT_HEX } from "@/components/flowbuilder/types";
import { api } from "@/lib/api";
import Palette from "@/components/flowbuilder/Palette";
import type { ReactFlowInstance } from "reactflow";

function genId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const nodeTypes = { typed: TypedNode } as const;

function makePort(name: string, type: PortType): Port {
  return { id: genId("p"), name, type, description: "" };
}

function makeNode(kind: NodeKind, position: { x: number; y: number }, title?: string, requiredInputType?: PortType): Node<TypedNodeData> {
  let inputs: Port[] = [];
  let outputs: Port[] = [];
  
  if (kind === "chainofthought") {
    inputs = [makePort("prompt", requiredInputType || "string")];
    outputs = [
      { ...makePort("reasoning", "string"), locked: true },
      makePort("output", "string")
    ];
  } else if (kind === "predict") {
    inputs = [makePort("prompt", requiredInputType || "string")];
    outputs = [makePort("output", "string")];
  } else if (kind === "input") {
    // Singleton input node: only outputs
    inputs = [];
    outputs = [makePort("prompt", "string")];
  } else if (kind === "output") {
    // Final sink: only inputs (start empty, add via drag)
    inputs = [makePort("output", requiredInputType || "string")];
    outputs = [];
  }

  return {
    id: genId("n"),
    type: "typed",
    position,
    data: { title: title ?? kind, kind, inputs, outputs },
  };
}


export default function FlowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const initialNodes = useMemo<Node<TypedNodeData>[]>(
    () => [
      makeNode("chainofthought", { x: 200, y: 200 }, "Chain Of Thought"),
      makeNode("predict", { x: 600, y: 220 }, "Predict"),
    ],
    []
  );
  
  const [flowTitle, setFlowTitle] = useState<string>("Flow");
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Track mouse position to place nodes at cursor when palette is used normally
  const [lastMousePos, setLastMousePos] = useState<{ x: number; y: number } | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<TypedNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // State for tracking drag-to-create functionality
  const [pendingConnection, setPendingConnection] = useState<{
    nodeId: string;
    handleId: string;
    handleType: 'source' | 'target';
    portType: PortType;
    position: { x: number; y: number };
  } | null>(null);

  // State for drag-to-add-input functionality
  const [dragState, setDragState] = useState<DragState>(null);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);

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

  // Listen for add-input-port events from nodes
  useEffect(() => {
    function handleAddInputPort(event: any) {
      const { targetNodeId, portType, sourceNodeId, sourceHandleId } = event.detail;
      
      // Find the target node and add a new input port
      setNodes((currentNodes) => {
        return currentNodes.map(node => {
          if (node.id === targetNodeId) {
            // Do not allow adding inputs to the global input node
            if (node.data.kind === 'input') return node;
            const newPort: Port = {
              id: genId("p"),
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
        setNodes((currentNodes) => {
          const targetNode = currentNodes.find(n => n.id === targetNodeId);
          if (targetNode) {
            const newInputPort = targetNode.data.inputs?.[targetNode.data.inputs.length - 1];
            if (newInputPort) {
              const newConnection = {
                source: sourceNodeId,
                sourceHandle: sourceHandleId,
                target: targetNodeId,
                targetHandle: `in-${newInputPort.id}`,
              };
              
              const edgeColor = PORT_HEX[portType as PortType] || "#64748b";
              setEdges((eds) => addEdge({
                ...newConnection,
                style: {
                  stroke: edgeColor,
                  strokeWidth: 3,
                },
              }, eds));
            }
          }
          return currentNodes;
        });
      }, 10);
      
      // Clear the drag state
      setDragState(null);
      window.dispatchEvent(new CustomEvent('drag-state-change', { detail: null }));
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

  function portTypeForNode(node: Node<TypedNodeData>, handleId: string): PortType | null {
    const pid = handleId.replace(/^in-|^out-/, "");
    const inp = node.data.inputs.find((p) => p.id === pid);
    if (inp) return inp.type;
    const outp = node.data.outputs.find((p) => p.id === pid);
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
      
      // Get the port type to style the edge
      const portType = portTypeFor(connection.source, connection.sourceHandle);
      const edgeColor = portType ? PORT_HEX[portType] : "#64748b"; // default gray
      
      setEdges((eds) => addEdge({ 
        ...connection,
        style: { 
          stroke: edgeColor,
          strokeWidth: 3,
        },
      }, eds));
    },
    [isValidConnection, setEdges, nodes]
  );

  const onConnectStart: OnConnectStart = useCallback((_, { nodeId, handleId, handleType }) => {
    if (!nodeId || !handleId || !handleType) return;
    
    const portType = portTypeFor(nodeId, handleId);
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

  const onConnectEnd: OnConnectEnd = useCallback((event) => {
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
      setPaletteOpen(true);
      // Don't clear drag state here - keep it for potential drop zone clicks
    } else {
      // Connection was dropped on a valid target - clear everything
      setPendingConnection(null);
      setDragState(null);
      window.dispatchEvent(new CustomEvent('drag-state-change', { detail: null }));
    }
  }, [rfInstance, pendingConnection]);

  const onSelectionChange = useCallback(({ nodes: n }: { nodes: Node[] }) => {
    setSelectedNodeId(n[0]?.id ?? null);
  }, []);

  function updateSelectedNode(data: TypedNodeData) {
    if (!selectedNodeId) return;
    
    // Ensure reasoning port is always present on chainofthought nodes
    if (data.kind === "chainofthought") {
      const hasReasoning = data.outputs.some(p => p.name === "reasoning");
      if (!hasReasoning) {
        data = {
          ...data,
          outputs: [{ ...makePort("reasoning", "string"), locked: true }, ...data.outputs]
        };
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
    const labelForKind = (k: NodeKind) =>
      k === 'chainofthought' ? 'Chain Of Thought' : k === 'predict' ? 'Predict' : k === 'input' ? 'Input' : 'Output';
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
    const labelForKind = (k: NodeKind) =>
      k === 'chainofthought' ? 'Chain Of Thought' : k === 'predict' ? 'Predict' : k === 'input' ? 'Input' : 'Output';
    const node = makeNode(kind, offsetPosition, labelForKind(kind), requiredType);
    
    // Add the node first
    setNodes((ns) => ns.concat(node));
    
    // Create the connection using the nodes state update callback to ensure we have the latest nodes
    setNodes((currentNodes) => {
      // The node is already added to currentNodes at this point
      
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
        
        if (sourceNode && targetNode && 
            newConnection.sourceHandle?.startsWith("out-") && 
            newConnection.targetHandle?.startsWith("in-") &&
            newConnection.source !== newConnection.target) {
          
          const sourcePortType = portTypeForNode(sourceNode, newConnection.sourceHandle);
          const targetPortType = portTypeForNode(targetNode, newConnection.targetHandle);
          
          if (sourcePortType && targetPortType && sourcePortType === targetPortType) {
            const portType = connection.portType;
            const edgeColor = PORT_HEX[portType] || "#64748b";
            
            // Use a small timeout to avoid React state update conflicts
            setTimeout(() => {
              setEdges((eds) => {
                const newEdge = { 
                  ...newConnection,
                  style: { 
                    stroke: edgeColor,
                    strokeWidth: 3,
                  },
                };
                return addEdge(newEdge, eds);
              });
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
    const nodeWidth = 240;
    const headerHeight = 41;
    const contentPaddingTop = 12;
    const portSpacing = 32;
    const handleSize = 14;
    
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
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          isValidConnection={isValidConnection}
          onSelectionChange={onSelectionChange}
          onInit={(inst) => setRfInstance(inst)}
          connectionLineComponent={CustomConnectionLine}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>

      <NodeInspector node={selectedNode ?? null} onChange={updateSelectedNode} onAddPort={addPort} onRemovePort={removePort} />
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
