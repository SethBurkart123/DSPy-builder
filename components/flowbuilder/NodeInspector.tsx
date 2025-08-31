"use client";

import { useMemo, useState } from "react";
import type { Node } from "reactflow";
import { type Port, type PortType, type TypedNodeData, type CustomSchema } from "./types";
import { 
  Plus, 
  Trash2,
  Type,
  List,
  ToggleLeft,
  Hash,
  Binary,
  Package,
  Layers,
  Settings,
  Library
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SchemaCreator } from "@/components/schema/SchemaCreator";
import { SchemaBrowser } from "@/components/schema/SchemaBrowser";
import { schemaManager } from "@/lib/schema-manager";

const ALL_TYPES: PortType[] = ["string", "string[]", "boolean", "float", "int", "array", "object"];

const getTypeIcon = (type: PortType) => {
  switch (type) {
    case "string":
      return <Type className="h-3 w-3" />;
    case "string[]":
      return <List className="h-3 w-3" />;
    case "boolean":
      return <ToggleLeft className="h-3 w-3" />;
    case "float":
      return <Hash className="h-3 w-3" />;
    case "int":
      return <Binary className="h-3 w-3" />;
    case "object":
      return <Package className="h-3 w-3" />;
    case "array":
      return <Layers className="h-3 w-3" />;
    default:
      return <Type className="h-3 w-3" />;
  }
};

const getTypeLabel = (type: PortType) => {
  switch (type) {
    case "string":
      return "Text";
    case "string[]":
      return "Text Array";
    case "boolean":
      return "Boolean";
    case "float":
      return "Decimal";
    case "int":
      return "Integer";
    case "object":
      return "Custom Object";
    case "array":
      return "Array";
    default:
      return type;
  }
};

export default function NodeInspector({
  node,
  onChange,
  onAddPort,
  onRemovePort,
}: {
  node: Node<TypedNodeData> | null;
  onChange: (data: TypedNodeData) => void;
  onAddPort: (direction: "inputs" | "outputs") => void;
  onRemovePort: (direction: "inputs" | "outputs", portId: string) => void;
}) {
  const data = node?.data;
  const hasNode = !!node;
  const title = useMemo(() => data?.title ?? "No selection", [data?.title]);
  
  const [schemaCreatorOpen, setSchemaCreatorOpen] = useState(false);
  const [schemaBrowserOpen, setSchemaBrowserOpen] = useState(false);
  const [editingPortIndex, setEditingPortIndex] = useState<{ direction: "inputs" | "outputs", index: number } | null>(null);
  const [availableSchemas, setAvailableSchemas] = useState<CustomSchema[]>([]);

  // Load available schemas when component mounts
  useMemo(() => {
    setAvailableSchemas(schemaManager.getAllSchemas());
  }, [schemaCreatorOpen, schemaBrowserOpen]);

  if (!hasNode) return null;

  function updatePort(direction: "inputs" | "outputs", idx: number, patch: Partial<Port>) {
    if (!data) return;
    const arr = [...(data[direction] || [])];
    arr[idx] = { ...arr[idx], ...patch };
    onChange({ ...data, [direction]: arr });
  }

  const handleCreateSchema = () => {
    setSchemaCreatorOpen(true);
  };

  const handleBrowseSchemas = () => {
    setSchemaBrowserOpen(true);
  };

  const handleSchemaCreated = (schema: CustomSchema) => {
    setAvailableSchemas(schemaManager.getAllSchemas());
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
      updatePort(editingPortIndex.direction, editingPortIndex.index, { 
        type: "object", 
        customSchema: schema 
      });
      setEditingPortIndex(null);
    }
  };

  const renderPortTypeDropdown = (port: Port, direction: "inputs" | "outputs", idx: number) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-gray-50">
            {getTypeIcon(port.type)}
            {port.type === "object" && port.customSchema ? port.customSchema.name : getTypeLabel(port.type)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {ALL_TYPES.filter(t => t !== "object").map((type) => (
            <DropdownMenuItem
              key={type}
              onClick={() => updatePort(direction, idx, { 
                type, 
                customSchema: undefined,
                arrayItemType: undefined,
                arrayItemSchema: undefined 
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
          {availableSchemas.length > 0 && (
            <DropdownMenuItem
              onClick={() => {
                setEditingPortIndex({ direction, index: idx });
                handleBrowseSchemas();
              }}
              className="flex items-center gap-2"
            >
              <Library className="h-3 w-3" />
              Select Existing Schema
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="fixed right-4 top-16 z-40 w-80 rounded-lg border bg-background p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>

      <div className="mt-4 space-y-6">
        <section>
          <div className="mb-2">
            <h4 className="text-xs font-medium uppercase text-muted-foreground">Inputs</h4>
          </div>
          <div className="space-y-3">
            {data?.inputs?.map((p, idx) => (
              <div key={p.id}>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded border px-2 py-1 text-xs"
                    value={p.name}
                    onChange={(e) => updatePort("inputs", idx, { name: e.target.value })}
                    placeholder="Port name"
                  />
                  {renderPortTypeDropdown(p, "inputs", idx)}
                  <button 
                    className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 rounded p-1.5" 
                    onClick={() => onRemovePort("inputs", p.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button 
            className="mt-3 flex w-full items-center justify-center gap-2 rounded border-2 border-dashed border-gray-300 py-2 text-xs text-gray-600 hover:border-gray-400 hover:bg-gray-50" 
            onClick={() => onAddPort("inputs")}
          >
            <Plus className="h-4 w-4" />
            Add Input
          </button>
        </section>

        <section>
          <div className="mb-2">
            <h4 className="text-xs font-medium uppercase text-muted-foreground">Outputs</h4>
          </div>
          <div className="space-y-3">
            {data?.outputs?.map((p, idx) => (
              <div key={p.id}>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded border px-2 py-1 text-xs"
                    value={p.name}
                    onChange={(e) => updatePort("outputs", idx, { name: e.target.value })}
                    placeholder="Port name"
                  />
                  {renderPortTypeDropdown(p, "outputs", idx)}
                  <button 
                    className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 rounded px-1 py-1" 
                    onClick={() => onRemovePort("outputs", p.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button 
            className="mt-3 flex w-full items-center justify-center gap-2 rounded border-2 border-dashed border-gray-300 py-2 text-xs text-gray-600 hover:border-gray-400 hover:bg-gray-50" 
            onClick={() => onAddPort("outputs")}
          >
            <Plus className="h-4 w-4" />
            Add Output
          </button>
        </section>

        {/* Schema Management */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium uppercase text-muted-foreground">Schema Library</h4>
            <button
              onClick={handleBrowseSchemas}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              <Library className="h-3 w-3" />
              Browse
            </button>
          </div>
          <button
            onClick={handleCreateSchema}
            className="flex w-full items-center justify-center gap-2 rounded border-2 border-dashed border-gray-300 py-2 text-xs text-gray-600 hover:border-gray-400 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Create Custom Schema
          </button>
        </section>
      </div>

      {/* Schema Creator Modal */}
      <SchemaCreator
        isOpen={schemaCreatorOpen}
        onClose={() => {
          setSchemaCreatorOpen(false);
          setEditingPortIndex(null);
        }}
        onSave={handleSchemaCreated}
      />

      {/* Schema Browser Modal */}
      <SchemaBrowser
        isOpen={schemaBrowserOpen}
        onClose={() => {
          setSchemaBrowserOpen(false);
          setEditingPortIndex(null);
        }}
        onCreateNew={() => {
          setSchemaBrowserOpen(false);
          setSchemaCreatorOpen(true);
        }}
        onEdit={(schema) => {
          setSchemaBrowserOpen(false);
          // Could open schema editor here
        }}
        onSelect={handleSchemaSelected}
        mode={editingPortIndex ? "select" : "browse"}
      />
    </div>
  );
}

