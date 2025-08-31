"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Code, FileText, AlertCircle } from "lucide-react";
import { CustomSchema, SchemaField } from "@/components/flowbuilder/types";
import { schemaManager } from "@/lib/schema-manager";
import { SchemaFieldBuilder } from "./SchemaFieldBuilder";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { filterPythonIdentifier, getPythonIdentifierError, toPascalCase } from "@/lib/python-identifier-utils";

interface SchemaCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schema: CustomSchema) => void;
  initialSchema?: CustomSchema;
  isNested?: boolean;
  title?: string;
  depth?: number;
}

export function SchemaCreator({ 
  isOpen, 
  onClose, 
  onSave, 
  initialSchema, 
  isNested = false, 
  title,
  depth = 0
}: SchemaCreatorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [availableSchemas, setAvailableSchemas] = useState<CustomSchema[]>([]);
  
  // Nested schema creation state
  const [nestedSchemaOpen, setNestedSchemaOpen] = useState(false);
  const [editingFieldForNested, setEditingFieldForNested] = useState<number | null>(null);
  const [nestedEditingSchema, setNestedEditingSchema] = useState<CustomSchema | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Load available schemas for object/array references
      setAvailableSchemas(schemaManager.getAllSchemas());
      
      if (initialSchema) {
        setName(initialSchema.name);
        setDescription(initialSchema.description || "");
        setFields([...initialSchema.fields]);
      } else {
        // Start with one empty field
        setName("");
        setDescription("");
        setFields([schemaManager.createField()]);
      }
      setErrors([]);
      setShowPreview(false);
    }
  }, [isOpen, initialSchema]);

  const handleSave = () => {
    const schemaData = { name, description, fields };
    const validationErrors = schemaManager.validateSchema(schemaData);
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    let savedSchema: CustomSchema;
    if (initialSchema) {
      savedSchema = schemaManager.updateSchema(initialSchema.id, schemaData)!;
    } else {
      savedSchema = schemaManager.saveSchema(schemaData);
    }
    
    onSave(savedSchema);
    onClose();
  };

  const addField = () => {
    setFields([...fields, schemaManager.createField()]);
  };

  const updateField = (index: number, updatedField: SchemaField) => {
    const newFields = [...fields];
    newFields[index] = updatedField;
    setFields(newFields);
  };

  const deleteField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    const newFields = [...fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFields(newFields);
  };

  const handleCreateNestedSchema = (fieldIndex: number) => {
    setEditingFieldForNested(fieldIndex);
    setNestedEditingSchema(null);
    setNestedSchemaOpen(true);
  };

  const handleEditNestedSchema = (fieldIndex: number, schema: CustomSchema) => {
    setEditingFieldForNested(fieldIndex);
    setNestedEditingSchema(schema);
    setNestedSchemaOpen(true);
  };

  const handleNestedSchemaCreated = (schema: CustomSchema) => {
    if (editingFieldForNested !== null) {
      const newFields = [...fields];
      newFields[editingFieldForNested] = {
        ...newFields[editingFieldForNested],
        type: "object",
        objectSchema: schema,
      };
      setFields(newFields);
    }
    setNestedSchemaOpen(false);
    setEditingFieldForNested(null);
    setNestedEditingSchema(null);
    setAvailableSchemas(schemaManager.getAllSchemas());
  };

  const generateDSPyCode = () => {
    if (!name || fields.length === 0) return "";
    
    try {
      return schemaManager.exportToDSPy({ name, description, fields, id: "", createdAt: new Date(), updatedAt: new Date() });
    } catch {
      return "// Error generating code preview";
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-6xl p-0">
          <div className="flex h-[600px]">
            {/* Main Editor */}
            <div className="flex-1 overflow-y-auto p-8 pt-0">
              <DialogHeader className="mb-6 pt-6 pb-2 flex bg-background sticky top-0">
                <DialogTitle>
                  {title || (initialSchema ? "Edit Schema" : "Create Custom Schema")}
                </DialogTitle>
                <DialogDescription>
                  Define a custom object type for DSPy workflows
                  {isNested && ` (Nested level ${depth + 1})`}
                </DialogDescription>
              </DialogHeader>

              {/* Schema Info */}
              <div className="mb-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="schema-name">Schema Name *</Label>
                  <Input
                    id="schema-name"
                    value={name}
                    onChange={(e) => {
                      const filtered = filterPythonIdentifier(e.target.value);
                      setName(filtered);
                    }}
                    placeholder="e.g., Answer, DocumentAnalysis, UserProfile"
                    className={getPythonIdentifierError(name) ? "border-destructive" : ""}
                  />
                  {getPythonIdentifierError(name) && (
                    <p className="text-xs text-destructive">{getPythonIdentifierError(name)}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="schema-description">Description</Label>
                  <Textarea
                    id="schema-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of what this schema represents... (optional)"
                    rows={2}
                  />
                </div>
              </div>

              {/* Fields */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-foreground">Fields</h3>
                  <Button onClick={addField} size="sm">
                    <Plus className="h-3 w-3" />
                    Add Field
                  </Button>
                </div>

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <SchemaFieldBuilder
                      key={field.id}
                      field={field}
                      onUpdate={(updatedField) => updateField(index, updatedField)}
                      onDelete={() => deleteField(index)}
                      onMoveUp={index > 0 ? () => moveField(index, "up") : undefined}
                      onMoveDown={index < fields.length - 1 ? () => moveField(index, "down") : undefined}
                      availableSchemas={availableSchemas.filter(s => s.id !== initialSchema?.id)}
                      onCreateNestedSchema={depth < 2 ? () => handleCreateNestedSchema(index) : undefined}
                      onEditNestedSchema={depth < 2 && fields[index].objectSchema ? (schema) => handleEditNestedSchema(index, schema) : undefined}
                    />
                  ))}
                </div>

                {fields.length === 0 && (
                  <div className="rounded border-2 border-dashed border-border py-8 text-center">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No fields defined</p>
                    <Button
                      variant="link"
                      onClick={addField}
                      className="mt-2"
                    >
                      Add your first field
                    </Button>
                  </div>
                )}
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <div className="mb-6 rounded border bg-destructive/10 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-destructive">Please fix the following errors:</h4>
                      <ul className="mt-1 list-disc list-inside text-sm text-destructive/90">
                        {errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Preview Panel */}
            <div className="w-80 border-l bg-muted/40">
              <div className="border-b bg-muted/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant={!showPreview ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setShowPreview(false)}
                  >
                    <FileText className="h-3 w-3" />
                    Preview
                  </Button>
                  <Button
                    variant={showPreview ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setShowPreview(true)}
                  >
                    <Code className="h-3 w-3" />
                    DSPy Code
                  </Button>
                </div>
              </div>

              <div className="h-full overflow-y-auto p-4">
                {showPreview ? (
                  <pre className="text-xs whitespace-pre-wrap font-mono text-foreground">
                    {generateDSPyCode()}
                  </pre>
                ) : (
                  <div className="space-y-3">
                    {name && (
                      <div>
                        <h4 className="text-sm font-medium text-foreground">{name}</h4>
                        {description && (
                          <p className="text-xs text-muted-foreground mt-1">{description}</p>
                        )}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      {fields.map((field) => (
                        <div key={field.id} className="rounded bg-card border p-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{field.name || "Unnamed"}</span>
                            <span className="text-xs text-muted-foreground">
                              {field.type === "array" && field.arrayItemType ? `${field.arrayItemType}[]` : field.type}
                            </span>
                          </div>
                          {field.description && (
                            <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
                          )}
                          {!field.required && (
                            <span className="text-xs text-muted-foreground">Optional</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="absolute bottom-4 right-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4" />
              {initialSchema ? "Update Schema" : "Create Schema"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nested Schema Creator - Only render if depth is reasonable */}
      {depth < 3 && (
        <SchemaCreator
          isOpen={nestedSchemaOpen}
          onClose={() => {
            setNestedSchemaOpen(false);
            setEditingFieldForNested(null);
            setNestedEditingSchema(null);
          }}
          onSave={handleNestedSchemaCreated}
          isNested={true}
          title={`${nestedEditingSchema ? 'Edit' : 'Create'} Schema for Field: ${editingFieldForNested !== null ? fields[editingFieldForNested]?.name || 'Unnamed' : ''}`}
          depth={depth + 1}
          initialSchema={nestedEditingSchema ?? undefined}
        />
      )}
    </>
  );
}
