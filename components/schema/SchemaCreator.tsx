"use client";

import { useState, useEffect } from "react";
import { X, Plus, Save, Code, FileText, AlertCircle } from "lucide-react";
import { CustomSchema, SchemaField } from "@/components/flowbuilder/types";
import { schemaManager } from "@/lib/schema-manager";
import { SchemaFieldBuilder } from "./SchemaFieldBuilder";

interface SchemaCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schema: CustomSchema) => void;
  initialSchema?: CustomSchema;
}

export function SchemaCreator({ isOpen, onClose, onSave, initialSchema }: SchemaCreatorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [availableSchemas, setAvailableSchemas] = useState<CustomSchema[]>([]);

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

  const generateDSPyCode = () => {
    if (!name || fields.length === 0) return "";
    
    try {
      return schemaManager.exportToDSPy({ name, description, fields, id: "", createdAt: new Date(), updatedAt: new Date() });
    } catch {
      return "// Error generating code preview";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-gray-50 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              {initialSchema ? "Edit Schema" : "Create Custom Schema"}
            </h2>
            <p className="text-sm text-gray-600">
              Define a custom object type for DSPy workflows
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[600px]">
          {/* Main Editor */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Schema Info */}
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schema Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Answer, DocumentAnalysis, UserProfile"
                  className="w-full rounded border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of what this schema represents..."
                  rows={2}
                  className="w-full rounded border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Fields */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700">Fields</h3>
                <button
                  onClick={addField}
                  className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                >
                  <Plus className="h-3 w-3" />
                  Add Field
                </button>
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
                  />
                ))}
              </div>

              {fields.length === 0 && (
                <div className="rounded border-2 border-dashed border-gray-300 py-8 text-center">
                  <FileText className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">No fields defined</p>
                  <button
                    onClick={addField}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    Add your first field
                  </button>
                </div>
              )}
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="mb-6 rounded border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Please fix the following errors:</h4>
                    <ul className="mt-1 list-disc list-inside text-sm text-red-700">
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
          <div className="w-80 border-l bg-gray-50">
            <div className="border-b bg-gray-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreview(false)}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                    !showPreview ? "bg-white shadow-sm" : "text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <FileText className="h-3 w-3" />
                  Preview
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                    showPreview ? "bg-white shadow-sm" : "text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <Code className="h-3 w-3" />
                  DSPy Code
                </button>
              </div>
            </div>

            <div className="h-full overflow-y-auto p-4">
              {showPreview ? (
                <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">
                  {generateDSPyCode()}
                </pre>
              ) : (
                <div className="space-y-3">
                  {name && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{name}</h4>
                      {description && (
                        <p className="text-xs text-gray-600 mt-1">{description}</p>
                      )}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <div key={field.id} className="rounded bg-white border p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{field.name || "Unnamed"}</span>
                          <span className="text-xs text-gray-500">
                            {field.type === "array" && field.arrayItemType ? `${field.arrayItemType}[]` : field.type}
                          </span>
                        </div>
                        {field.description && (
                          <p className="text-xs text-gray-600 mt-1">{field.description}</p>
                        )}
                        {!field.required && (
                          <span className="text-xs text-gray-500">Optional</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            <Save className="h-4 w-4" />
            {initialSchema ? "Update Schema" : "Create Schema"}
          </button>
        </div>
      </div>
    </div>
  );
}
