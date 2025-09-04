"use client";

import { memo, useEffect, useState } from "react";
import { NodeProps, useUpdateNodeInternals, type Node } from "@xyflow/react";
import { type TypedNodeData } from "./types";
import { getNodeDefinition } from "@/lib/node-def";
import { HEADER_HEIGHT, PORT_ROW_HEIGHT } from "@/lib/flow-utils";
import { PortListSection, ControlGroupSection } from "./sections";
import { Loader2 } from "lucide-react";

function TypedNodeComponent({ data, selected, id }: NodeProps<Node<TypedNodeData>>) {
  const [isDragHovering, setIsDragHovering] = useState(false);
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    function updateInternals(event: any) {
      updateNodeInternals(event.detail.id)
    }
    window.addEventListener("update-node-internals", updateInternals);
    return () => window.removeEventListener("update-node-internals", updateInternals);
  }, []);
  
  // Calculate minimum height needed for all ports (exclude the special model row)
  const inputsWithoutModel = (data.inputs || []).filter(p => !(p.type === 'llm' && p.name === 'model'));
  const maxPorts = Math.max(inputsWithoutModel.length || 0, data.outputs?.length || 0);
  const headerHeight = HEADER_HEIGHT;
  const portSpacing = PORT_ROW_HEIGHT;
  const baseContentPadding = 24; // grid padding top + bottom
  const minContentHeight = maxPorts * portSpacing;
  const minTotalHeight = headerHeight + minContentHeight + baseContentPadding;

  const status = data.runtime?.status;
  let glowColor = '';
  if (status === 'running') {
    // Tools glow amber when running; other nodes glow rose
    glowColor = 'rgba(245,158,11,0.55)'; // amber-500
  } else if (status === 'done') {
    glowColor = 'rgba(16,185,129,0.55)'; // emerald-500
  } else if (status === 'error') {
    glowColor = 'rgba(239,68,68,0.55)'; // red-500
  }

  const boxShadow = glowColor ? `0 0 0 ${selected ? "3px" : "1px"} ${glowColor}` : undefined;

  return (
    <div 
      className={`relative ${data.kind.startsWith('tool_') ? 'tool-node' : ''}`}
      style={{ padding: '8px' }}
      onMouseEnter={() => setIsDragHovering(true)}
      onMouseLeave={() => setIsDragHovering(false)}
    >
      
    {data.kind.startsWith('tool_') ? 
      (
        <div 
        className={`w-[240px] rounded-full border bg-card text-card-foreground shadow ${selected ? "outline-primary/50 outline-3" : ""} relative flex flex-col`}
        style={{ boxShadow }}
      >
        <div className="flex items-center justify-between bg-muted/50 px-3 py-2 relative rounded-full">
          <div className="text-xs font-semibold truncate">{data.title}</div>
          {status === 'running' && (
            <div className="absolute right-2 top-2 text-[10px] rounded-full">
              <Loader2 className="h-3.5 w-3.5 animate-spin opacity-80" />
            </div>
          )}

          {(() => {
            const def = getNodeDefinition(data.kind);
            return def.sections.map((sec) => {
              if (sec.type === "port_list" && sec.role === "outputs") {
                return (
                  <div key={sec.id}>
                    <PortListSection
                      nodeId={id}
                      data={data}
                      role="outputs"
                      autogrow={sec.autogrow}
                      accepts={sec.accepts}
                      isDragHovering={isDragHovering}
                      hideLabels={true}
                    />
                  </div>
                );
              }
              return null;
            });
          })()}
        </div>
      </div>
      )
    : 
      (
        <div 
        className={`w-[240px] border bg-card text-card-foreground rounded-md shadow ${selected ? "outline-primary/50 outline-3" : ""} relative flex flex-col`}
        style={{ minHeight: `${minTotalHeight}px`, boxShadow }}
      >
        <div className="flex items-center justify-between rounded-t-lg border-b bg-muted/50 px-3 py-2 pb-[14px] relative">
          <div className="text-xs font-semibold truncate">{data.title}</div>
          {status === 'running' && (
            <div className="absolute right-2 top-2 text-[10px] rounded-full">
              <Loader2 className="h-3.5 w-3.5 animate-spin opacity-80" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 flex-1">
          {(() => {
            const def = getNodeDefinition(data.kind);
            return def.sections.map((sec) => {
              const span = (sec as any).colSpan === 1 ? "col-span-1" : "col-span-2";
              if (sec.type === "empty_spacer") {
                return <div key={sec.id} className={span} />;
              }
              if (sec.type === "control_group") {
                return (
                  <div key={sec.id} className={span}>
                    <ControlGroupSection nodeId={id} data={data} controls={sec.controls} />
                  </div>
                );
              }
              if (sec.type === "port_list" && sec.role === "inputs") {
                return (
                  <div key={sec.id} className={span}>
                    <PortListSection
                      nodeId={id}
                      data={data}
                      role="inputs"
                      autogrow={sec.autogrow}
                      accepts={sec.accepts}
                      isDragHovering={isDragHovering}
                    />
                  </div>
                );
              }
              if (sec.type === "port_list" && sec.role === "outputs") {
                return (
                  <div key={sec.id} className={span}>
                    <PortListSection
                      nodeId={id}
                      data={data}
                      role="outputs"
                      autogrow={sec.autogrow}
                      accepts={sec.accepts}
                      isDragHovering={isDragHovering}
                    />
                  </div>
                );
              }
              return null;
            });
          })()}
        </div>
      </div>
      )}
    </div>
  );
}

export const TypedNode = memo(TypedNodeComponent);
