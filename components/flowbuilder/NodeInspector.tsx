"use client";

import { useMemo, useState } from "react";
import type { Node } from "@xyflow/react";
import { type Port, type PortType, type TypedNodeData, type CustomSchema } from "./types";
import { 
  Plus, 
  Trash2,
  Package,
  Library
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CodeEditor } from "@/components/code/CodeEditor";
import { SchemaCreator } from "@/components/schema/SchemaCreator";
import { SchemaSelector } from "@/components/schema/SchemaSelector";
import { generateDSPyCode } from "@/lib/generate-dspy";
import { LiteralValuesEditor } from "@/components/common/LiteralValuesEditor";

// Exclude internal-only 'llm' from user type dropdowns
const ALL_TYPES: PortType[] = ["string", "string[]", "boolean", "float", "int", "literal", "custom", "array", "object"];

import { typeIcon, typeLabel } from "./typeDisplay";
const getTypeIcon = (type: PortType) => typeIcon(type, "h-3 w-3");
const getTypeLabel = (type: PortType) => typeLabel(type);

export default function NodeInspector({
  node,
  onChange,
  onAddPort,
  onRemovePort,
  onRunNode,
  flowId,
  finalOutputs,
}: {
  node: Node<TypedNodeData> | null;
  onChange: (data: TypedNodeData) => void;
  onAddPort: (direction: "inputs" | "outputs") => void;
  onRemovePort: (direction: "inputs" | "outputs", portId: string) => void;
  onRunNode?: (nodeId: string) => void;
  flowId: string;
  finalOutputs?: { name: string; value: any }[];
}) {
  const data = node?.data;
  const hasNode = !!node;
  const title = useMemo(() => data?.title ?? "No selection", [data?.title]);
  
  const [schemaCreatorOpen, setSchemaCreatorOpen] = useState(false);
  const [editingSchema, setEditingSchema] = useState<CustomSchema | null>(null);
  const [schemaSelectorOpen, setSchemaSelectorOpen] = useState(false);
  const [editingPortIndex, setEditingPortIndex] = useState<{ direction: "inputs" | "outputs", index: number } | null>(null);
  const [schemaSelectContext, setSchemaSelectContext] = useState<'portObject' | 'arrayItem' | null>(null);
  const [showCode, setShowCode] = useState(false);
  
  // Simple client-side validation for custom Python tools
  const toolValidation = useMemo(() => {
    if (data?.kind !== 'tool_python') return null;
    const code = (data?.values as any)?.code as string | undefined;
    if (!code || code.trim().length === 0) return { ok: false, msg: 'Tool code is empty' };
    if (!/\bdef\s+[A-Za-z_]\w*\s*\(/.test(code)) return { ok: false, msg: 'Must define at least one function (def ...)' };
    if (!/\breturn\b/.test(code)) return { ok: false, msg: 'Function must have a return statement' };
    return { ok: true, msg: 'Looks good' };
  }, [data]);

  if (!hasNode) return null;

  const canEditInputs = data?.kind !== 'input' && data?.kind !== 'llm' && !(data?.kind?.startsWith('tool_'));
  const canEditOutputs = data?.kind !== 'output' && data?.kind !== 'llm' && !(data?.kind?.startsWith('tool_'));

  function updatePort(direction: "inputs" | "outputs", idx: number, patch: Partial<Port>) {
    if (!data) return;
    const arr = [...(data[direction] || [])];
    arr[idx] = { ...arr[idx], ...patch };
    onChange({ ...data, [direction]: arr });
  }

  function updateNode(patch: Partial<TypedNodeData>) {
    if (!data) return;
    onChange({ ...data, ...patch });
  }

  const handleCreateSchema = () => {
    setEditingSchema(null);
    setSchemaCreatorOpen(true);
  };

  const handleSchemaCreated = (schema: CustomSchema) => {
    // If we were editing a port, apply the new schema
    if (editingPortIndex) {
      updatePort(editingPortIndex.direction, editingPortIndex.index, { 
        type: "object", 
        customSchema: schema 
      });
      setEditingPortIndex(null);
    }
  };

  const handleSchemaSelected = (schema: CustomSchema) => {
    if (editingPortIndex) {
      if (schemaSelectContext === 'arrayItem') {
        updatePort(editingPortIndex.direction, editingPortIndex.index, {
          type: 'array',
          arrayItemType: 'object',
          arrayItemSchema: schema,
        });
      } else {
        updatePort(editingPortIndex.direction, editingPortIndex.index, {
          type: 'object',
          customSchema: schema,
        });
      }
      setEditingPortIndex(null);
      setSchemaSelectContext(null);
    }
  };

  const handleSelectExistingSchema = (direction: "inputs" | "outputs", idx: number) => {
    setEditingPortIndex({ direction, index: idx });
    setSchemaSelectContext('portObject');
    setSchemaSelectorOpen(true);
  };

  const renderPortTypeDropdown = (port: Port, direction: "inputs" | "outputs", idx: number) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {getTypeIcon(port.type)}
            {port.type === "object" && port.customSchema ? port.customSchema.name : getTypeLabel(port.type)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {ALL_TYPES.filter(t => t !== "object").map((type) => (
            <DropdownMenuItem
              key={type}
              onClick={() => updatePort(direction, idx, { 
                type, 
                customSchema: undefined,
                arrayItemType: undefined,
                arrayItemSchema: undefined,
                arrayItemCustomType: undefined,
                customType: undefined,
                literalKind: undefined,
                literalValues: undefined,
                arrayItemLiteralKind: undefined,
                arrayItemLiteralValues: undefined,
              })}
              className="flex items-center gap-2"
            >
              {getTypeIcon(type)}
              {getTypeLabel(type)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setEditingPortIndex({ direction, index: idx });
              handleCreateSchema();
            }}
            className="flex items-center gap-2"
          >
            <Package className="h-3 w-3" />
            Create Custom Object
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleSelectExistingSchema(direction, idx)}
            className="flex items-center gap-2"
          >
            <Library className="h-3 w-3" />
            Select Existing Schema
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderPortTypeConfig = (p: Port, direction: "inputs" | "outputs", idx: number) => {
    // Array item configuration
    if (p.type === 'array') {
      return (
        <div className="ml-4 mt-2 space-y-2 border-l-2 border-border pl-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Array contains:</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {p.arrayItemType ? getTypeIcon(p.arrayItemType) : getTypeIcon('string')}
                  <span className="ml-1">{p.arrayItemType ? getTypeLabel(p.arrayItemType) : 'Select type'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {ALL_TYPES.filter(t => t !== 'array').map((type) => (
                  <DropdownMenuItem key={type} className="flex items-center gap-2" onClick={() => updatePort(direction, idx, { arrayItemType: type, arrayItemSchema: undefined, arrayItemCustomType: undefined, arrayItemLiteralKind: undefined, arrayItemLiteralValues: undefined })}>
                    {getTypeIcon(type)}
                    {getTypeLabel(type)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {p.arrayItemType === 'object' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Object schema:</span>
              <Button variant="outline" size="sm" onClick={() => { setEditingPortIndex({ direction, index: idx }); setSchemaSelectContext('arrayItem'); setSchemaSelectorOpen(true); }}>
                <Package className="h-3 w-3 mr-1" />
                {p.arrayItemSchema ? (p.arrayItemSchema.name || 'Unknown') : 'Select schema'}
              </Button>
            </div>
          )}
          {p.arrayItemType === 'custom' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Custom item type:</span>
              <Input className="h-7 text-xs" placeholder="e.g., Dict[str, Any]" value={p.arrayItemCustomType || ''} onChange={(e) => updatePort(direction, idx, { arrayItemCustomType: e.target.value })} />
            </div>
          )}
          {p.arrayItemType === 'literal' && (
            <div className="space-y-2">
              <LiteralValuesEditor
                kind={p.arrayItemLiteralKind as any}
                values={p.arrayItemLiteralValues}
                onKindChange={(k) => updatePort(direction, idx, { arrayItemLiteralKind: k, arrayItemLiteralValues: [] })}
                onChange={(vals) => updatePort(direction, idx, { arrayItemLiteralValues: vals })}
                baseKindLabel="Base kind"
                valuesLabel="Allowed item values"
                compact
              />
            </div>
          )}
        </div>
      );
    }
    // Object schema config
    if (p.type === 'object') {
      return (
        <div className="ml-4 mt-2 space-y-2 border-l-2 border-border pl-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Object schema:</span>
            <Button variant="outline" size="sm" onClick={() => { setEditingPortIndex({ direction, index: idx }); setSchemaSelectContext('portObject'); setSchemaSelectorOpen(true); }}>
              <Package className="h-3 w-3 mr-1" />
              {p.customSchema ? (p.customSchema.name || 'Unknown') : 'Select schema'}
            </Button>
          </div>
        </div>
      );
    }
    if (p.type === 'custom') {
      return (
        <div className="ml-4 mt-2 space-y-2 border-l-2 border-border pl-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Custom type:</span>
            <Input className="h-7 text-xs" placeholder="e.g., Dict[str, Any] or MyType" value={p.customType || ''} onChange={(e) => updatePort(direction, idx, { customType: e.target.value })} />
          </div>
        </div>
      );
    }
    if (p.type === 'literal') {
      return (
        <div className="ml-4 mt-2 space-y-2 border-l-2 border-border pl-3">
          <LiteralValuesEditor
            kind={p.literalKind as any}
            values={p.literalValues}
            onKindChange={(k) => updatePort(direction, idx, { literalKind: k, literalValues: [] })}
            onChange={(vals) => updatePort(direction, idx, { literalValues: vals })}
            baseKindLabel="Base kind"
            valuesLabel="Allowed values"
            compact
          />
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed right-4 top-16 z-40 w-96 rounded-lg border bg-background p-4 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold truncate">{title}</h3>
        <div className="flex items-center gap-2">
          {(data?.kind === 'predict' || data?.kind === 'chainofthought' || data?.kind === 'agent') && (
            <Button size="sm" onClick={() => onRunNode?.(node!.id)}>Run</Button>
          )}
          {(data && !(data.kind === 'input' || data.kind === 'output' || data.kind === 'llm')) && (
            <Button variant="outline" size="sm" onClick={() => setShowCode((v) => !v)}>
              {showCode ? 'Hide DSPy Code' : 'Show DSPy Code'}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-6">
        {/* Output node final outputs preview */}
        {data?.kind === 'output' && finalOutputs && finalOutputs.length > 0 && (
          <section>
            <div className="mb-2">
              <h4 className="text-xs font-medium uppercase text-muted-foreground">Final Outputs</h4>
            </div>
            <div className="space-y-2">
              {finalOutputs.map((fo) => (
                <div key={fo.name}>
                  <div className="text-[11px] font-medium text-muted-foreground">{fo.name}</div>
                  <pre className="mt-1 max-h-40 overflow-auto rounded border bg-muted/40 p-2 text-[11px] whitespace-pre-wrap">
{(() => {
  try {
    if (typeof fo.value === 'string') return fo.value;
    return JSON.stringify(fo.value, null, 2);
  } catch {
    return String(fo.value);
  }
})()}
                  </pre>
                </div>
              ))}
            </div>
          </section>
        )}
        {/* Node-level description (hidden for input/output/llm/tool_*) */}
        {!(data?.kind === 'input' || data?.kind === 'output' || data?.kind === 'llm' || data?.kind?.startsWith('tool_')) && (
          <section>
            <div className="mb-2">
              <h4 className="text-xs font-medium uppercase text-muted-foreground">Description</h4>
            </div>
            <Textarea
              className="text-xs"
              value={data?.description || ""}
              onChange={(e) => updateNode({ description: e.target.value })}
              placeholder="Optional node description (Signature docstring)"
              rows={3}
            />
          </section>
        )}

        {/* Custom Python tool code editor */}
        {data?.kind === 'tool_python' && (
          <section>
            <div className="mb-2">
              <h4 className="text-xs font-medium uppercase text-muted-foreground">Tool Function</h4>
            </div>
            <CodeEditor
              value={data?.values?.code || ''}
              onChange={(val) => onChange({ ...data, values: { ...(data.values || {}), code: val } })}
              language="python"
              height={260}
            />
            <div className={`mt-1 text-[11px] ${toolValidation?.ok ? 'text-emerald-600' : 'text-red-600'}`}>
              {toolValidation?.msg}
            </div>
          </section>
        )}

        {/* Input node initial values */}
        {data?.kind === 'input' && (
          <section>
            <div className="mb-2">
              <h4 className="text-xs font-medium uppercase text-muted-foreground">Initial Values</h4>
            </div>
            <div className="space-y-2">
              {data.outputs?.map((p) => (
                <div key={p.id}>
                  <label className="text-[11px] text-muted-foreground">{p.name}</label>
                  <Input
                    value={data.values?.[p.name] ?? ''}
                    onChange={(e) => onChange({ ...data, values: { ...(data.values || {}), [p.name]: e.target.value } })}
                    placeholder={`Enter ${p.name}`}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
        
        {/* Inputs */}
        {canEditInputs && (
        <section className="p-2 bg-accent/30 rounded-md dark:border-border/50 border-border border">
          <div className="mb-2">
            <h4 className="text-xs font-medium uppercase text-muted-foreground">Inputs</h4>
          </div>
          <div className="space-y-3">
            {data?.inputs
              // Hide special LLM provider input on predict/chainofthought
              ?.filter(p => {
                if (!data) return true;
                const isLLMModel = p.type === 'llm' && p.name === 'model';
                const isHiddenForKind = data.kind === 'predict' || data.kind === 'chainofthought' || data.kind === 'agent';
                const isToolsHandle = p.type === 'tool' && p.name === 'tools' && data.kind === 'agent';
                return !(isHiddenForKind && isLLMModel) && !isToolsHandle;
              })
              .map((p, idx) => {
                const actualIdx = data?.inputs?.findIndex(port => port.id === p.id) ?? idx;
                return (
               <div key={p.id} className="space-y-2">
                 <div className="flex items-center gap-2">
                   <Input
                     className="flex-1"
                     value={p.name}
                    onChange={(e) => updatePort("inputs", actualIdx, { name: e.target.value })}
                     placeholder="Port name"
                   />
                   {renderPortTypeDropdown(p, "inputs", actualIdx)}
                   <label className="flex items-center gap-1 text-[11px] text-foreground select-none">
                     <input
                       type="checkbox"
                       checked={!!p.optional}
                       onChange={(e) => updatePort("inputs", actualIdx, { optional: e.target.checked })}
                       className="rounded accent-current"
                     />
                     Optional
                   </label>
                   <Button 
                     variant="ghost"
                     size="sm"
                     className={`text-red-600 hover:text-red-700 hover:bg-red-50 ${p.locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                    onClick={() => { if (!p.locked) onRemovePort("inputs", p.id); }}
                   >
                     <Trash2 className="h-3 w-3" />
                   </Button>
                 </div>
                  {data?.kind !== 'output' && (
                    <Textarea
                      className="text-xs"
                      value={p.description || ""}
                      onChange={(e) => updatePort("inputs", actualIdx, { description: e.target.value })}
                      placeholder="Description (optional)"
                      rows={2}
                    />
                  )}
                  {renderPortTypeConfig(p, "inputs", actualIdx)}
                </div>
              );
            })}
          </div>
          <Button 
            variant="outline"
            className="mt-3 w-full border-dashed" 
            onClick={() => onAddPort("inputs")}
          >
            <Plus className="h-4 w-4" />
            Add Input
          </Button>
        </section>
        )}

        {canEditOutputs && (
        <section className="p-2 bg-accent/30 rounded-md dark:border-border/50 border-border border">
          <div className="mb-2">
            <h4 className="text-xs font-medium uppercase text-muted-foreground">Outputs</h4>
          </div>
          <div className="space-y-3">
            {data?.outputs?.filter(p => !(data.kind === "chainofthought" && p.name === "reasoning")).map((p, idx) => {
              // Get the actual index in the original outputs array for updates
              const actualIdx = data?.outputs?.findIndex(port => port.id === p.id) ?? idx;
              return (
                <div key={p.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      value={p.name}
                      onChange={(e) => updatePort("outputs", actualIdx, { name: e.target.value })}
                      placeholder="Port name"
                    />
                    {renderPortTypeDropdown(p, "outputs", actualIdx)}
                    <label className="flex items-center gap-1 text-[11px] text-foreground select-none">
                      <input
                        type="checkbox"
                        checked={!!p.optional}
                        onChange={(e) => updatePort("outputs", actualIdx, { optional: e.target.checked })}
                        className="rounded accent-current"
                      />
                      Optional
                    </label>
                    <Button 
                      variant="ghost"
                      size="sm"
                      className={`text-red-600 hover:text-red-700 hover:bg-red-50 ${p.locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                      onClick={() => { if (!p.locked) onRemovePort("outputs", p.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <Textarea
                    className="text-xs"
                    value={p.description || ""}
                    onChange={(e) => updatePort("outputs", actualIdx, { description: e.target.value })}
                    placeholder="Description (optional)"
                    rows={2}
                  />
                  {renderPortTypeConfig(p, "outputs", actualIdx)}
                </div>
              );
            })}
          </div>
          <Button 
            variant="outline"
            className="mt-3 w-full border-dashed" 
            onClick={() => onAddPort("outputs")}
          >
            <Plus className="h-4 w-4" />
            Add Output
          </Button>
        </section>
        )}

        {/* Schema creation and selection remain available contextually via dropdowns */}
      </div>

      {/* Schema Creator Modal */}
      <SchemaCreator
        isOpen={schemaCreatorOpen}
        onClose={() => {
          setSchemaCreatorOpen(false);
          setEditingPortIndex(null);
          setEditingSchema(null);
        }}
        onSave={handleSchemaCreated}
        initialSchema={editingSchema ?? undefined}
        flowId={flowId}
      />

      {/* Schema Selector Modal */}
      <SchemaSelector
        isOpen={schemaSelectorOpen}
        onClose={() => {
          setSchemaSelectorOpen(false);
          setEditingPortIndex(null);
        }}
        onSelect={handleSchemaSelected}
        title="Select Schema"
        description="Choose a schema for this port"
        flowId={flowId}
      />

      {/* DSPy code preview inline under header toggle */}
      {(data && showCode) && (
        <div className="mt-3">
          <CodeEditor
            value={generateDSPyCode(data)}
            onChange={() => { /* read-only */ }}
            language="python"
            height={280}
            readOnly
            options={{ fontSize: 12 }}
          />
        </div>
      )}
    </div>
  );
}
