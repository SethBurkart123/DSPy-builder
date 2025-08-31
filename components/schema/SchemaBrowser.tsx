"use client";

import { useState, useEffect } from "react";
import { Package, Edit, Trash2, Copy, Code, Search, Plus, Type, List, ToggleLeft, Hash, Binary, Layers } from "lucide-react";
import { CustomSchema } from "@/components/flowbuilder/types";
import { schemaManager } from "@/lib/schema-manager";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SchemaBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNew: () => void;
  onEdit: (schema: CustomSchema) => void;
  onSelect?: (schema: CustomSchema) => void;
  mode?: "browse" | "select";
}

export function SchemaBrowser({ 
  isOpen, 
  onClose, 
  onCreateNew, 
  onEdit, 
  onSelect,
  mode = "browse" 
}: SchemaBrowserProps) {
  const [schemas, setSchemas] = useState<CustomSchema[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSchema, setSelectedSchema] = useState<CustomSchema | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSchemas();
    }
  }, [isOpen]);

  const loadSchemas = () => {
    setSchemas(schemaManager.getAllSchemas());
  };

  const handleDelete = async (schema: CustomSchema) => {
    if (confirm(`Are you sure you want to delete the schema "${schema.name}"?`)) {
      schemaManager.deleteSchema(schema.id);
      loadSchemas();
      if (selectedSchema?.id === schema.id) {
        setSelectedSchema(null);
      }
    }
  };

  const handleCopyCode = (schema: CustomSchema) => {
    const code = schemaManager.exportToDSPy(schema);
    navigator.clipboard.writeText(code);
    // Could add a toast notification here
  };

  const filteredSchemas = schemas.filter(schema =>
    schema.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (schema.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeLabel = (t: string) => {
    switch (t) {
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
        return "Object";
      case "array":
        return "Array";
      default:
        return t;
    }
  };

  const getTypeIcon = (t: string) => {
    switch (t) {
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

  // Render nested structure of a schema up to a sane depth
  const renderNestedSchema = (schema: CustomSchema, level: number = 1, maxLevels: number = 4) => {
    if (!schema || level > maxLevels) return null;
    return (
      <div className={`mt-2 space-y-2 rounded border bg-muted/40 p-3 ${level > 1 ? 'ml-3' : ''}`}>
        {schema.fields.map((f) => (
          <div key={`${schema.id}-${f.id}-${level}`} className="text-xs">
            <div className="flex items-center gap-2">
              {getTypeIcon(f.type as string)}
              <span className="font-medium">{f.name}</span>
              <span className="rounded bg-muted px-2 py-0.5 text-[10px]">
                {f.type === 'array' && f.arrayItemType ? `${f.arrayItemType}[]` : getTypeLabel(f.type as string)}
              </span>
              {!f.required && <span className="text-muted-foreground">optional</span>}
            </div>
            {f.description && (
              <div className="mt-1 text-muted-foreground">{f.description}</div>
            )}
            {f.type === 'object' && (f as any).objectSchemaId && (
              <div className="mt-2">{schemaManager.getSchema((f as any).objectSchemaId) && renderNestedSchema(schemaManager.getSchema((f as any).objectSchemaId)!, level + 1, maxLevels)}</div>
            )}
            {f.type === 'array' && (f as any).arrayItemSchemaId && (
              <div className="mt-2">{schemaManager.getSchema((f as any).arrayItemSchemaId) && renderNestedSchema(schemaManager.getSchema((f as any).arrayItemSchemaId)!, level + 1, maxLevels)}</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-6xl p-0">
        <div className="flex h-[600px]">
          {/* Schema List */}
          <div className="w-80 border-r bg-muted/40">
            <DialogHeader>
              <div className="flex items-center justify-between p-6 pb-0">
                <div>
                  <DialogTitle>
                    {mode === "select" ? "Select Schema" : "Schema Library"}
                  </DialogTitle>
                  <DialogDescription>
                    {mode === "select" 
                      ? "Choose a schema to use in your workflow"
                      : "Manage your custom object schemas"
                    }
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Search */}
            <div className="border-b p-4 flex gap-2">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search schemas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={onCreateNew}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Schema List */}
            <div className="overflow-y-auto h-full">
              {filteredSchemas.map((schema) => (
                <div
                  key={schema.id}
                  className={`cursor-pointer border-b p-3 transition-colors hover:bg-accent hover:text-accent-foreground ${
                    selectedSchema?.id === schema.id ? "bg-accent/80" : "bg-card"
                  }`}
                  onClick={() => setSelectedSchema(schema)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <span className="font-medium text-sm">{schema.name}</span>
                      </div>
                      {schema.description ? (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {schema.description} {'\u2022'}  {schema.fields.length} field{schema.fields.length !== 1 ? 's' : ''}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {schema.fields.length} field{schema.fields.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {filteredSchemas.length === 0 && (
                <div className="text-center py-8">
                  <Package className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {searchTerm ? "No schemas match your search" : "No schemas created yet"}
                  </p>
                  <Button
                    variant="link"
                    onClick={onCreateNew}
                    className="mt-2"
                  >
                    Create your first schema
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Schema Details */}
          <div className="flex-1 overflow-y-auto">
            {selectedSchema ? (
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold">{selectedSchema.name}</h3>
                    {selectedSchema.description && (
                      <p className="text-muted-foreground mt-2">{selectedSchema.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span>{selectedSchema.fields.length} fields</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {mode === "select" && onSelect && (
                      <Button
                        onClick={() => onSelect(selectedSchema)}
                      >
                        Select Schema
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => onEdit(selectedSchema)}
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleCopyCode(selectedSchema)}
                    >
                      <Code className="h-4 w-4" />
                      Copy Code
                    </Button>
                    <Button variant="destructive" onClick={() => handleDelete(selectedSchema)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Fields */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium">Fields</h4>
                  <div className="space-y-3">
                    {selectedSchema.fields.map((field) => (
                      <div key={field.id} className="rounded border bg-muted/40 p-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(field.type as string)}
                            <span className="font-medium">{field.name}</span>
                            <span className="rounded bg-muted px-2 py-0.5 text-xs">
                              {field.type === 'array' && field.arrayItemType ? `${field.arrayItemType}[]` : getTypeLabel(field.type as string)}
                            </span>
                            {!field.required && (
                              <span className="text-xs text-muted-foreground">optional</span>
                            )}
                          </div>
                          {field.description && (
                            <p className="text-sm text-muted-foreground">{field.description}</p>
                          )}
                          {field.type === 'object' && field.objectSchemaId && (
                            <div>{schemaManager.getSchema(field.objectSchemaId) && renderNestedSchema(schemaManager.getSchema(field.objectSchemaId)!)}</div>
                          )}
                          {field.type === 'array' && field.arrayItemSchemaId && (
                            <div>{schemaManager.getSchema(field.arrayItemSchemaId) && renderNestedSchema(schemaManager.getSchema(field.arrayItemSchemaId)!)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DSPy Code Preview */}
                <div className="mt-8">
                  <h4 className="text-lg font-medium mb-3">DSPy Code</h4>
                  <div className="rounded border bg-muted/40 p-4">
                    <pre className="text-sm whitespace-pre-wrap font-mono text-foreground">
                      {schemaManager.exportToDSPy(selectedSchema)}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground/60" />
                  <p className="mt-4">Select a schema to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
