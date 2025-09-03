"use client";

import { memo, useEffect, useState } from "react";
import { NodeProps, useUpdateNodeInternals } from "reactflow";
import { type TypedNodeData } from "./types";
import { getNodeDefinition } from "@/lib/node-def";
import { HEADER_HEIGHT, PORT_ROW_HEIGHT } from "@/lib/flow-utils";
import { PortListSection, ControlGroupSection } from "./sections";

function TypedNodeComponent({ data, selected, id }: NodeProps<TypedNodeData>) {
  const [isDragHovering, setIsDragHovering] = useState(false);
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    function updateInternals(event: any) {
      updateNodeInternals(event.detail.id)
      console.log("updated", event.detail.id)
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
  const boxShadow = status === 'running'
    ? '0 0 14px rgba(244,63,94,0.6)'
    : status === 'done'
    ? '0 0 12px rgba(16,185,129,0.5)'
    : undefined;

  return (
    <div 
      className="relative"
      style={{ padding: '20px' }}
      onMouseEnter={() => setIsDragHovering(true)}
      onMouseLeave={() => setIsDragHovering(false)}
    >
      <div 
        className={`w-[240px] rounded-lg border bg-card text-card-foreground shadow ${selected ? "outline-primary/50 outline-2" : ""} relative flex flex-col`}
        style={{ minHeight: `${minTotalHeight}px`, boxShadow }}
      >
        <div className="flex items-center justify-between rounded-t-lg border-b bg-muted/50 px-3 py-2 pb-[14px]">
          <div className="text-xs font-semibold truncate">{data.title}</div>
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
    </div>
  );
}

export const TypedNode = memo(TypedNodeComponent);
