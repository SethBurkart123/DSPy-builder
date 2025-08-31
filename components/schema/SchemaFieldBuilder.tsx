"use client";

import { useState } from "react";
import { 
  Trash2, 
  Type, 
  List, 
  ToggleLeft, 
  Hash, 
  Binary, 
  Package, 
  Layers,
  GripVertical,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SchemaField, PortType, CustomSchema } from "@/components/flowbuilder/types";
import { schemaManager } from "@/lib/schema-manager";

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

const ALL_TYPES: PortType[] = ["string", "int", "float", "boolean", "array", "object"];

interface SchemaFieldBuilderProps {
  field: SchemaField;
  onUpdate: (field: SchemaField) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  showMoveButtons?: boolean;
  availableSchemas: CustomSchema[];
  depth?: number;
}

export function SchemaFieldBuilder({
  field,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  showMoveButtons = true,
  availableSchemas,
  depth = 0
}: SchemaFieldBuilderProps) {
  const [expanded, setExpanded] = useState(false);

  const updateField = (updates: Partial<SchemaField>) => {
    onUpdate({ ...field, ...updates });
  };

  const handleTypeChange = (newType: PortType) => {
    const updates: Partial<SchemaField> = { type: newType };
    
    // Clear type-specific properties when changing types
    if (newType !== "array") {
      updates.arrayItemType = undefined;
      updates.arrayItemSchema = undefined;
    }
    if (newType !== "object") {
      updates.objectSchema = undefined;
    }
    
    updateField(updates);
  };

  const renderArrayConfig = () => {
    if (field.type !== "array") return null;

    return (
      <div className="ml-4 mt-2 space-y-2 border-l-2 border-gray-200 pl-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Array contains:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-gray-50">
                {field.arrayItemType ? getTypeIcon(field.arrayItemType) : <Type className="h-3 w-3" />}
                {field.arrayItemType ? getTypeLabel(field.arrayItemType) : "Select type"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {ALL_TYPES.filter(t => t !== "array").map((type) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => updateField({ arrayItemType: type, arrayItemSchema: undefined })}
                  className="flex items-center gap-2"
                >
                  {getTypeIcon(type)}
                  {getTypeLabel(type)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {field.arrayItemType === "object" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Object schema:</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-gray-50">
                  <Package className="h-3 w-3" />
                  {field.arrayItemSchema?.name || "Select schema"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {availableSchemas.map((schema) => (
                  <DropdownMenuItem
                    key={schema.id}
                    onClick={() => updateField({ arrayItemSchema: schema })}
                    className="flex items-center gap-2"
                  >
                    <Package className="h-3 w-3" />
                    {schema.name}
                  </DropdownMenuItem>
                ))}
                {availableSchemas.length === 0 && (
                  <div className="px-2 py-1 text-xs text-gray-500">No schemas available</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    );
  };

  const renderObjectConfig = () => {
    if (field.type !== "object") return null;

    return (
      <div className="ml-4 mt-2 space-y-2 border-l-2 border-gray-200 pl-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Object schema:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-gray-50">
                <Package className="h-3 w-3" />
                {field.objectSchema?.name || "Select schema"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {availableSchemas.map((schema) => (
                <DropdownMenuItem
                  key={schema.id}
                  onClick={() => updateField({ objectSchema: schema })}
                  className="flex items-center gap-2"
                >
                  <Package className="h-3 w-3" />
                  {schema.name}
                </DropdownMenuItem>
              ))}
              {availableSchemas.length === 0 && (
                <div className="px-2 py-1 text-xs text-gray-500">No schemas available</div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {field.objectSchema && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Preview {field.objectSchema.name} fields
            </button>
            
            {expanded && (
              <div className="mt-2 space-y-1 rounded border bg-gray-50 p-2">
                {field.objectSchema.fields.map((subField) => (
                  <div key={subField.id} className="flex items-center gap-2 text-xs">
                    {getTypeIcon(subField.type)}
                    <span className="font-medium">{subField.name}</span>
                    <span className="text-gray-600">({getTypeLabel(subField.type)})</span>
                    {!subField.required && <span className="text-gray-500">optional</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const indentStyle = depth > 0 ? { marginLeft: `${depth * 16}px` } : {};

  return (
    <div className="space-y-2" style={indentStyle}>
      <div className="rounded border bg-white p-3">
        <div className="flex items-start gap-2">
          {showMoveButtons && (
            <div className="flex flex-col">
              <GripVertical className="h-3 w-3 text-gray-400" />
            </div>
          )}
          
          <div className="flex-1 space-y-3">
            {/* Field name and type */}
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded border px-2 py-1 text-sm"
                value={field.name}
                onChange={(e) => updateField({ name: e.target.value })}
                placeholder="Field name"
              />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-gray-50">
                    {getTypeIcon(field.type)}
                    {getTypeLabel(field.type)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {ALL_TYPES.map((type) => (
                    <DropdownMenuItem
                      key={type}
                      onClick={() => handleTypeChange(type)}
                      className="flex items-center gap-2"
                    >
                      {getTypeIcon(type)}
                      {getTypeLabel(type)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => updateField({ required: e.target.checked })}
                  className="rounded"
                />
                Required
              </label>

              <button 
                className="text-red-600 hover:bg-red-50 rounded p-1" 
                onClick={onDelete}
                title="Delete field"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            {/* Description */}
            <div>
              <textarea
                className="w-full rounded border px-2 py-1 text-xs"
                value={field.description || ""}
                onChange={(e) => updateField({ description: e.target.value })}
                placeholder="Description (helps with prompt engineering)"
                rows={2}
              />
            </div>

            {/* Type-specific configuration */}
            {renderArrayConfig()}
            {renderObjectConfig()}
          </div>
        </div>
      </div>
    </div>
  );
}
