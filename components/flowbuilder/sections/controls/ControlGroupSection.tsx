"use client";

import { Handle, Position } from "@xyflow/react";
import type { TypedNodeData, PortType } from "@/components/flowbuilder/types";
import type { ControlSpec } from "@/lib/node-def";
import { handleStyleForPort, HANDLE_SIZE, NODE_GRID_PADDING_X } from "@/lib/flow-utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";

const ROW_HEIGHT = 32;

function getByPath(obj: any, path: string): any {
  return path.split(".").reduce((acc: any, k: string) => (acc ? acc[k] : undefined), obj);
}

function setTopPatch(data: any, path: string, value: any): any {
  // Only supports top-level + one nested key: e.g., "llm.model"
  const segs = path.split(".");
  const top = segs[0];
  if (segs.length === 1) {
    return { [top]: value };
  }

  const current = data?.[top] || {};
  const copy = { ...current };
  // Only one level deep is used in our current paths
  (copy as any)[segs[1]] = value;
  return { [top]: copy };
}


export function ControlGroupSection({
  nodeId,
  data,
  controls,
}: {
  nodeId: string;
  data: TypedNodeData;
  controls: ControlSpec[];
}) {
  return (
    <div className="space-y-2">
      {controls.map((ctl) => {
        const boundFlag = ctl.bind?.boundFlagPath ? !!getByPath(data, ctl.bind.boundFlagPath) : false;
        const inputPort = ctl.bind?.inputPortName
          ? (data.inputs || []).find((p) => p.name === ctl.bind!.inputPortName)
          : undefined;
        const renderControl = !(ctl.bind?.hideWhenBound && boundFlag);
        const value = getByPath(data, ctl.dataPath) ?? "";

        return (
          <div key={ctl.id} className="relative">
            {/* Optional input handle for bindable controls */}
            {ctl.bind && inputPort && (
              <Handle
                id={`in-${inputPort.id}`}
                type="target"
                position={Position.Left}
                className="border !border-border absolute"
                style={{
                  ...handleStyleForPort((ctl.bind.portType || inputPort.type) as PortType),
                  left: -(HANDLE_SIZE / 2) - NODE_GRID_PADDING_X,
                  top: 18,
                }}
              />
            )}

            {renderControl ? (
              <div className="flex-1">
                {ctl.label && (
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{ctl.label}</div>
                )}
                {ctl.type === "text" && (
                  <Input
                    value={value}
                    onChange={(e) => {
                      const patch = setTopPatch(data, ctl.dataPath, e.target.value || undefined);
                      const ev = new CustomEvent("update-node-data", { detail: { nodeId, patch } });
                      window.dispatchEvent(ev);
                    }}
                    placeholder={ctl.placeholder || ctl.label}
                    className="h-8 text-[12px]"
                  />
                )}
                {ctl.type === "number" && (
                  <Input
                    type="number"
                    step={ctl.step ?? 1}
                    min={ctl.min}
                    max={ctl.max}
                    value={value ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? undefined : Number(e.target.value);
                      const patch = setTopPatch(data, ctl.dataPath, v);
                      const ev = new CustomEvent("update-node-data", { detail: { nodeId, patch } });
                      window.dispatchEvent(ev);
                    }}
                    placeholder={ctl.placeholder || ctl.label}
                    className="h-8 text-[12px]"
                  />
                )}
                {ctl.type === "select" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-8 w-full justify-between text-[12px]">
                        {(ctl.options || []).find(o => o.value === value)?.label || value || (ctl.placeholder || 'Select')}
                        <span className="ml-2 text-muted-foreground">▾</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                      {(ctl.options || []).map((opt) => (
                        <DropdownMenuItem
                          key={opt.value}
                          onClick={() => {
                            const patch = setTopPatch(data, ctl.dataPath, opt.value || undefined);
                            const ev = new CustomEvent("update-node-data", { detail: { nodeId, patch } });
                            window.dispatchEvent(ev);
                          }}
                        >
                          {opt.label ?? opt.value}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {ctl.type === "slider" && (
                  <div className="flex items-center gap-2">
                    <Slider
                      min={ctl.min ?? 0}
                      max={ctl.max ?? 100}
                      step={ctl.step ?? 1}
                      value={typeof value === 'number' ? value : Number(value || 0)}
                      onValueChange={(v) => {
                        const patch = setTopPatch(data, ctl.dataPath, v);
                        const ev = new CustomEvent("update-node-data", { detail: { nodeId, patch } });
                        window.dispatchEvent(ev);
                      }}
                    />
                    <div className="w-12 text-right text-[11px] text-muted-foreground">{(typeof value === 'number' ? value : Number(value || 0)).toFixed(2)}</div>
                  </div>
                )}
              </div>
            ) : (
              // When bound and hidden, show a subtle bound summary to avoid an "empty" state
              <div className="flex-1">
                <div className="h-7 text-[11px] flex items-center text-muted-foreground">
                  {ctl.label || ctl.id}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
