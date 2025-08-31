"use client";

import { useState, useEffect } from "react";
import { Package, Edit, Trash2, Copy, Code, Search, Plus } from "lucide-react";
import { CustomSchema } from "@/components/flowbuilder/types";
import { schemaManager } from "@/lib/schema-manager";

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-gray-50 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              {mode === "select" ? "Select Schema" : "Schema Library"}
            </h2>
            <p className="text-sm text-gray-600">
              {mode === "select" 
                ? "Choose a schema to use in your workflow"
                : "Manage your custom object schemas"
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              New Schema
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex h-[600px]">
          {/* Schema List */}
          <div className="w-80 border-r bg-gray-50">
            {/* Search */}
            <div className="border-b p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search schemas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded border pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Schema List */}
            <div className="overflow-y-auto h-full p-4 space-y-2">
              {filteredSchemas.map((schema) => (
                <div
                  key={schema.id}
                  className={`cursor-pointer rounded border p-3 transition-colors ${
                    selectedSchema?.id === schema.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedSchema(schema)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-purple-600" />
                        <span className="font-medium text-sm">{schema.name}</span>
                      </div>
                      {schema.description && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {schema.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">
                          {schema.fields.length} field{schema.fields.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {schema.updatedAt.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredSchemas.length === 0 && (
                <div className="text-center py-8">
                  <Package className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">
                    {searchTerm ? "No schemas match your search" : "No schemas created yet"}
                  </p>
                  <button
                    onClick={onCreateNew}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    Create your first schema
                  </button>
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
                      <p className="text-gray-600 mt-2">{selectedSchema.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <span>{selectedSchema.fields.length} fields</span>
                      <span>Created {selectedSchema.createdAt.toLocaleDateString()}</span>
                      <span>Updated {selectedSchema.updatedAt.toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {mode === "select" && onSelect && (
                      <button
                        onClick={() => onSelect(selectedSchema)}
                        className="flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                      >
                        Select Schema
                      </button>
                    )}
                    <button
                      onClick={() => onEdit(selectedSchema)}
                      className="flex items-center gap-1 rounded border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleCopyCode(selectedSchema)}
                      className="flex items-center gap-1 rounded border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      <Code className="h-4 w-4" />
                      Copy Code
                    </button>
                    <button
                      onClick={() => handleDelete(selectedSchema)}
                      className="flex items-center gap-1 rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>

                {/* Fields */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium">Fields</h4>
                  <div className="space-y-3">
                    {selectedSchema.fields.map((field) => (
                      <div key={field.id} className="rounded border bg-gray-50 p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{field.name}</span>
                              <span className="rounded bg-gray-200 px-2 py-1 text-xs">
                                {field.type}
                                {field.type === "array" && field.arrayItemType && `<${field.arrayItemType}>`}
                              </span>
                              {!field.required && (
                                <span className="text-xs text-gray-500">optional</span>
                              )}
                            </div>
                            {field.description && (
                              <p className="text-sm text-gray-600 mt-2">{field.description}</p>
                            )}
                            
                            {/* Show nested schema info */}
                            {field.type === "object" && field.objectSchema && (
                              <div className="mt-2 text-sm text-blue-600">
                                References: {field.objectSchema.name}
                              </div>
                            )}
                            {field.type === "array" && field.arrayItemSchema && (
                              <div className="mt-2 text-sm text-blue-600">
                                Array of: {field.arrayItemSchema.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DSPy Code Preview */}
                <div className="mt-8">
                  <h4 className="text-lg font-medium mb-3">DSPy Code</h4>
                  <div className="rounded border bg-gray-50 p-4">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                      {schemaManager.exportToDSPy(selectedSchema)}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Package className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-4">Select a schema to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
