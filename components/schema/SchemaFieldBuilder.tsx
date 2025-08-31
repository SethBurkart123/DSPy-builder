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
  ChevronRight,
  Plus
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
import { Label } from "@/components/ui/label";
import { SchemaField, PortType, CustomSchema } from "@/components/flowbuilder/types";
import { schemaManager } from "@/lib/schema-manager";
import { filterPythonIdentifier, getPythonIdentifierError, toSnakeCase } from "@/lib/python-identifier-utils";
import { SchemaSelector } from "./SchemaSelector";

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
  onCreateNestedSchema?: () => void;
}

export function SchemaFieldBuilder({
  field,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  showMoveButtons = true,
  availableSchemas,
  depth = 0,
  onCreateNestedSchema
}: SchemaFieldBuilderProps) {
  const [expanded, setExpanded] = useState(false);
  const [schemaSelectorOpen, setSchemaSelectorOpen] = useState(false);
  const [selectorContext, setSelectorContext] = useState<'object' | 'arrayItem' | null>(null);

  const updateField = (updates: Partial<SchemaField>) => {
    onUpdate({ ...field, ...updates });
  };

  const handleSchemaSelect = (schema: CustomSchema) => {
    if (selectorContext === 'object') {
      updateField({ objectSchema: schema });
    } else if (selectorContext === 'arrayItem') {
      updateField({ arrayItemSchema: schema });
    }
    setSelectorContext(null);
  };

  const openSchemaSelector = (context: 'object' | 'arrayItem') => {
    setSelectorContext(context);
    setSchemaSelectorOpen(true);
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
          <Label className="text-xs text-gray-600">Array contains:</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {field.arrayItemType ? getTypeIcon(field.arrayItemType) : <Type className="h-3 w-3" />}
                <span className="ml-1">{field.arrayItemType ? getTypeLabel(field.arrayItemType) : "Select type"}</span>
              </Button>
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
            <Label className="text-xs text-gray-600">Object schema:</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Package className="h-3 w-3 mr-1" />
                  {field.arrayItemSchema?.name || "Select schema"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {onCreateNestedSchema && (
                  <>
                    <DropdownMenuItem
                      onClick={onCreateNestedSchema}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-3 w-3" />
                      Create New Schema
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => openSchemaSelector('arrayItem')}
                  className="flex items-center gap-2"
                >
                  <Package className="h-3 w-3" />
                  Select Schema...
                </DropdownMenuItem>
                {availableSchemas.length === 0 && !onCreateNestedSchema && (
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
          <Label className="text-xs text-gray-600">Object schema:</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Package className="h-3 w-3 mr-1" />
                {field.objectSchema?.name || "Select schema"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {onCreateNestedSchema && (
                <>
                  <DropdownMenuItem
                    onClick={onCreateNestedSchema}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-3 w-3" />
                    Create New Schema
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={() => openSchemaSelector('object')}
                className="flex items-center gap-2"
              >
                <Package className="h-3 w-3" />
                Select Schema...
              </DropdownMenuItem>
              {availableSchemas.length === 0 && !onCreateNestedSchema && (
                <div className="px-2 py-1 text-xs text-gray-500">No schemas available</div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {field.objectSchema && (
          <div className="mt-2">
            <Button
              variant="link"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="p-0 h-auto text-xs"
            >
              {expanded ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
              Preview {field.objectSchema.name} fields
            </Button>
            
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
              <div className="flex-1 space-y-1">
                <Input
                  value={field.name}
                  onChange={(e) => {
                    const filtered = filterPythonIdentifier(e.target.value);
                    updateField({ name: filtered });
                  }}
                  placeholder="Field name (e.g., user_name, is_active)"
                  className={getPythonIdentifierError(field.name) ? "border-red-500" : ""}
                />
                {getPythonIdentifierError(field.name) && (
                  <p className="text-xs text-red-600">{getPythonIdentifierError(field.name)}</p>
                )}
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {getTypeIcon(field.type)}
                    <span className="ml-1">{getTypeLabel(field.type)}</span>
                  </Button>
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

              <Button 
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2"
                title="Delete field"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            {/* Description */}
            <div>
              <Textarea
                className="text-xs"
                value={field.description || ""}
                onChange={(e) => updateField({ description: e.target.value })}
                placeholder="Description (optional)"
                rows={2}
              />
            </div>

            {/* Type-specific configuration */}
            {renderArrayConfig()}
            {renderObjectConfig()}
          </div>
        </div>
      </div>

      {/* Schema Selector Modal */}
      <SchemaSelector
        isOpen={schemaSelectorOpen}
        onClose={() => {
          setSchemaSelectorOpen(false);
          setSelectorContext(null);
        }}
        onSelect={handleSchemaSelect}
        title={selectorContext === 'arrayItem' ? "Select Array Item Schema" : "Select Object Schema"}
        description={selectorContext === 'arrayItem' ? "Choose a schema for array items" : "Choose a schema for this object field"}
      />
    </div>
  );
}