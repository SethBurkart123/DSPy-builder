"use client";

import { useState, useEffect } from "react";
import { Package, Search } from "lucide-react";
import { CustomSchema } from "@/components/flowbuilder/types";
import { schemaManager } from "@/lib/schema-manager";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface SchemaSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (schema: CustomSchema) => void;
  title?: string;
  description?: string;
}

export function SchemaSelector({ 
  isOpen, 
  onClose, 
  onSelect,
  title = "Select Schema",
  description = "Choose a schema to use"
}: SchemaSelectorProps) {
  const [schemas, setSchemas] = useState<CustomSchema[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSchemas(schemaManager.getAllSchemas());
      setSearchTerm("");
    }
  }, [isOpen]);

  const filteredSchemas = schemas.filter(schema =>
    schema.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (schema.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (schema: CustomSchema) => {
    onSelect(schema);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search schemas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Schema List */}
        <div className="max-h-64 overflow-y-auto space-y-2">
          {filteredSchemas.map((schema) => (
            <div
              key={schema.id}
              className="cursor-pointer rounded border p-3 transition-colors hover:border-blue-300 hover:bg-blue-50"
              onClick={() => handleSelect(schema)}
            >
              <div className="flex items-start gap-2">
                <Package className="h-4 w-4 text-purple-600 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{schema.name}</div>
                  {schema.description && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {schema.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
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
                {searchTerm ? "No schemas match your search" : "No schemas available"}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
