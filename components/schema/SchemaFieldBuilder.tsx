"use client";

import { useState } from "react";
import { 
  Trash2,
  Package,
  GripVertical,
  Plus,
  Type
} from "lucide-react";
import { Edit } from "lucide-react";
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
import { useFlowSchemas } from "@/lib/useFlowSchemas";
import { filterPythonIdentifier, getPythonIdentifierError } from "@/lib/python-identifier-utils";
import { SchemaSelector } from "./SchemaSelector";
import { typeIcon, typeLabel } from "@/components/flowbuilder/typeDisplay";
import { LiteralValuesEditor } from "@/components/common/LiteralValuesEditor";

const getTypeIcon = (type: PortType) => typeIcon(type, "h-3 w-3");
const getTypeLabel = (type: PortType) => typeLabel(type);

const ALL_TYPES: PortType[] = ["string", "int", "float", "boolean", "literal", "custom", "array", "object"];

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
  onEditNestedSchema?: (schema: CustomSchema) => void;
  rootSchemaId?: string;
  flowId: string;
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
  onCreateNestedSchema,
  onEditNestedSchema,
  rootSchemaId,
  flowId,
}: SchemaFieldBuilderProps) {
  const { getSchema, wouldIntroduceCycle } = useFlowSchemas(flowId);
  const [schemaSelectorOpen, setSchemaSelectorOpen] = useState(false);
  const [selectorContext, setSelectorContext] = useState<'object' | 'arrayItem' | null>(null);
  // Literal editor local state (per field UI instance)
  const [literalPending, setLiteralPending] = useState("");
  const [literalEditIndex, setLiteralEditIndex] = useState<number | null>(null);
  const [literalEditValue, setLiteralEditValue] = useState<string>("");

  const updateField = (updates: Partial<SchemaField>) => {
    onUpdate({ ...field, ...updates });
  };

  const handleSchemaSelect = (schema: CustomSchema) => {
    // Prevent circular references when editing an existing schema
    if (rootSchemaId && wouldIntroduceCycle(rootSchemaId, schema.id)) {
      // Silently ignore; could add a toast in the future
      return;
    }
    if (selectorContext === 'object') {
      updateField({ objectSchemaId: schema.id });
    } else if (selectorContext === 'arrayItem') {
      updateField({ arrayItemSchemaId: schema.id });
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
      (updates as any).arrayItemSchemaId = undefined;
      (updates as any).arrayItemCustomType = undefined;
    }
    if (newType !== "object") {
      (updates as any).objectSchemaId = undefined;
    }
    if (newType !== "custom") {
      (updates as any).customType = undefined;
    }
    if (newType !== "literal") {
      (updates as any).literalKind = undefined;
      (updates as any).literalValues = undefined;
    }
    
    updateField(updates);
  };

  // Recursive preview up to 4 nested levels
  const renderNestedFields = (schema?: CustomSchema, level: number = 1, maxLevels: number = 4) => {
    if (!schema || level > maxLevels) return null;
    return (
      <div className={`mt-2 space-y-1 rounded border bg-muted/40 p-2 ${level > 1 ? 'ml-3' : ''}`}>
        {schema.fields.map((sub) => (
          <div key={`${schema.id}-${sub.id}-${level}`} className="flex flex-col gap-1 text-xs">
            <div className="flex items-center gap-2">
              {getTypeIcon(sub.type)}
              <span className="font-medium">{sub.name}</span>
              <span className="text-muted-foreground">({getTypeLabel(sub.type)})</span>
              {!sub.required && <span className="text-muted-foreground">optional</span>}
            </div>
            {sub.type === 'object' && sub.objectSchemaId && (
              <div>{renderNestedFields(getSchema(sub.objectSchemaId), level + 1, maxLevels)}</div>
            )}
            {sub.type === 'array' && sub.arrayItemSchemaId && (
              <div>{renderNestedFields(getSchema(sub.arrayItemSchemaId), level + 1, maxLevels)}</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderArrayConfig = () => {
    if (field.type !== "array") return null;

    return (
      <div className="ml-4 mt-2 space-y-2 border-l-2 border-border pl-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Array contains:</Label>
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
                  onClick={() => updateField({ arrayItemType: type, arrayItemSchemaId: undefined, arrayItemCustomType: undefined } as any)}
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
            <Label className="text-xs text-muted-foreground">Object schema:</Label>
            <Button variant="outline" size="sm" onClick={() => openSchemaSelector('arrayItem')}>
              <Package className="h-3 w-3 mr-1" />
              {field.arrayItemSchemaId ? (getSchema(field.arrayItemSchemaId)?.name || 'Unknown') : "Select schema"}
            </Button>
            {onCreateNestedSchema && (
              <Button variant="outline" size="icon" onClick={onCreateNestedSchema} title="Create new schema">
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
        {field.arrayItemType === "custom" && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Custom item type:</Label>
            <Input
              className="h-7 text-xs"
              placeholder="e.g., Dict[str, Any]"
              value={field.arrayItemCustomType || ''}
              onChange={(e) => updateField({ arrayItemCustomType: e.target.value })}
            />
          </div>
        )}
        {field.arrayItemSchemaId && renderNestedFields(getSchema(field.arrayItemSchemaId) || undefined)}
      </div>
    );
  };

  const renderObjectConfig = () => {
    if (field.type !== "object") return null;

    return (
      <div className="ml-4 mt-2 space-y-2 border-l-2 border-border pl-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Object schema:</Label>
          <Button variant="outline" size="sm" onClick={() => openSchemaSelector('object')}>
            <Package className="h-3 w-3 mr-1" />
            {field.objectSchemaId ? (getSchema(field.objectSchemaId)?.name || 'Unknown') : "Select schema"}
          </Button>
          {field.objectSchemaId && onEditNestedSchema && (
            <Button variant="ghost" size="icon" onClick={() => {
              const s = getSchema(field.objectSchemaId!);
              if (s) onEditNestedSchema(s);
            }} title="Edit schema">
              <Edit className="h-3 w-3" />
            </Button>
          )}
        </div>

        {field.objectSchemaId && (
          <div className="mt-2">
            {renderNestedFields(getSchema(field.objectSchemaId) || undefined)}
          </div>
        )}
      </div>
    );
  };

  const renderCustomConfig = () => {
    if (field.type !== 'custom') return null;
    return (
      <div className="ml-4 mt-2 space-y-2 border-l-2 border-border pl-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Custom type:</Label>
          <Input
            className="h-7 text-xs"
            placeholder="e.g., Dict[str, Any] or MyType"
            value={field.customType || ''}
            onChange={(e) => updateField({ customType: e.target.value })}
          />
        </div>
      </div>
    );
  };

  const renderLiteralConfig = () => {
    if (field.type !== 'literal') return null;
    return (
      <div className="ml-4 mt-2 space-y-2 border-l-2 border-border pl-3">
        <LiteralValuesEditor
          kind={field.literalKind as any}
          values={field.literalValues}
          onKindChange={(k) => updateField({ literalKind: k, literalValues: [] })}
          onChange={(vals) => updateField({ literalValues: vals })}
          baseKindLabel="Base kind"
          valuesLabel="Allowed values"
          compact
        />
      </div>
    );
  };

  const indentStyle = depth > 0 ? { marginLeft: `${depth * 16}px` } : {};

  return (
    <div className="space-y-2" style={indentStyle}>
      <div className="rounded border bg-card p-3">
        <div className="flex items-start gap-2">
          {showMoveButtons && (
            <div className="flex flex-col">
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
          
          <div className="flex-1 space-y-3">
            {/* Field name and type */}
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-1 relative">
                <Input
                  value={field.name}
                  onChange={(e) => {
                    const filtered = filterPythonIdentifier(e.target.value);
                    updateField({ name: filtered });
                  }}
                  placeholder="Field name (e.g., user_name, is_active)"
                  className={getPythonIdentifierError(field.name) ? "border-destructive" : "border-border"}
                />
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

              <label className="flex items-center gap-1 text-xs text-foreground select-none" title="If checked, this field is optional (required=False)">
                <input
                  type="checkbox"
                  checked={!field.required}
                  onChange={(e) => updateField({ required: !e.target.checked })}
                  className="rounded accent-current"
                />
                Optional
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
            {renderCustomConfig()}
            {renderLiteralConfig()}
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
        onCreateNew={onCreateNestedSchema}
        flowId={flowId}
      />
    </div>
  );
}
