"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type ApiFlowSchema, type ApiSchemaField } from "@/lib/api";
import type { CustomSchema, SchemaField, PortType } from "@/components/flowbuilder/types";

function toCustomSchema(a: ApiFlowSchema): CustomSchema {
  return {
    id: a.id,
    name: a.name,
    description: a.description || undefined,
    fields: a.fields.map(toSchemaField),
  };
}

function toSchemaField(f: ApiSchemaField): SchemaField {
  return {
    id: f.id,
    name: f.name,
    type: f.type as PortType,
    description: f.description || undefined,
    required: f.required,
    arrayItemType: f.arrayItemType as PortType | undefined,
    arrayItemSchemaId: f.arrayItemSchemaId || undefined,
    objectSchemaId: f.objectSchemaId || undefined,
  };
}

function fromSchemaField(f: SchemaField): ApiSchemaField {
  return {
    id: f.id,
    name: f.name,
    type: f.type,
    description: f.description,
    required: f.required,
    arrayItemType: f.arrayItemType,
    arrayItemSchemaId: f.arrayItemSchemaId,
    objectSchemaId: f.objectSchemaId,
  };
}

export function useFlowSchemas(flowId: string) {
  const [schemas, setSchemas] = useState<CustomSchema[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listFlowSchemas(flowId);
      setSchemas(list.map(toCustomSchema));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getSchema = useCallback((id: string): CustomSchema | undefined => schemas.find(s => s.id === id), [schemas]);

  const createField = useCallback((): SchemaField => ({
    id: generateFieldId(),
    name: "",
    type: "string",
    required: true,
    description: "",
  }), []);

  const validateSchema = useCallback((schema: Omit<CustomSchema, "id">): string[] => {
    const errors: string[] = [];
    if (!schema.name.trim()) errors.push("Schema name is required");
    if (schema.fields.length === 0) errors.push("Schema must have at least one field");
    schema.fields.forEach((field, index) => {
      if (!field.name.trim()) errors.push(`Field ${index + 1}: Name is required`);
      const duplicates = schema.fields.filter(f => f.name === field.name);
      if (duplicates.length > 1) errors.push(`Field "${field.name}": Duplicate field names are not allowed`);
      if (field.type === "array" && !field.arrayItemType) errors.push(`Field "${field.name}": Array type requires item type specification`);
      if (field.type === "object" && !field.objectSchemaId) errors.push(`Field "${field.name}": Object type requires schema specification`);
    });
    return errors;
  }, []);

  const exportToDSPy = useCallback((schema: CustomSchema): string => {
    const getDSPyType = (field: SchemaField): string => {
      switch (field.type) {
        case "string": return "str";
        case "int": return "int";
        case "float": return "float";
        case "boolean": return "bool";
        case "array":
          if (field.arrayItemType === "string") {
            return "List[str]";
          } else if (field.arrayItemType === "int") {
            return "List[int]";
          } else if (field.arrayItemType === "float") {
            return "List[float]";
          } else if (field.arrayItemType === "boolean") {
            return "List[bool]";
          } else if (field.arrayItemSchemaId) {
            const s = getSchema(field.arrayItemSchemaId);
            return `List[${s?.name || 'dict'}]`;
          } else {
            return "List[dict]";
          }
        case "object":
          if (field.objectSchemaId) {
            const s = getSchema(field.objectSchemaId);
            return s?.name || "dict";
          } else {
            return "dict";
          }
        default:
          return "str";
      }
    };

    const fields = schema.fields.map(field => {
      const dspyType = getDSPyType(field);
      const description = field.description || `${field.name} field`;
      
      // Determine if this should be an InputField or OutputField based on common naming patterns
      // Fields ending with "output", "result", "answer", "response" are typically outputs
      const isLikelyOutput = /^(output|result|answer|response|conclusion|summary|prediction|score)(_|$)/i.test(field.name) ||
                           /_(output|result|answer|response|conclusion|summary|prediction|score)$/i.test(field.name);
      
      const fieldType = isLikelyOutput ? "OutputField" : "InputField";
      
      // Generate field with proper DSPy syntax
      let fieldDeclaration = `${field.name}: ${dspyType} = dspy.${fieldType}(desc="${description}"`;
      
      // Add optional parameter for non-required fields (only for InputFields)
      if (!field.required && !isLikelyOutput) {
        fieldDeclaration += ', required=False';
      }
      
      fieldDeclaration += ')';
      
      return `    ${fieldDeclaration}`;
    });

    // Generate DSPy imports
    const imports = [
      "import dspy",
      "from typing import List, Optional"
    ];

    // Check if we need nested schema imports
    const nestedSchemas = new Set<string>();
    const collectNestedSchemas = (field: SchemaField) => {
      if (field.objectSchemaId) {
        const s = getSchema(field.objectSchemaId);
        if (s) nestedSchemas.add(s.name);
      }
      if (field.arrayItemSchemaId) {
        const s = getSchema(field.arrayItemSchemaId);
        if (s) nestedSchemas.add(s.name);
      }
    };
    schema.fields.forEach(collectNestedSchemas);

    const nestedImports = Array.from(nestedSchemas).length > 0 
      ? `\n# Import nested schemas: ${Array.from(nestedSchemas).join(', ')}`
      : '';

    const classDefinition = `class ${schema.name}(dspy.Signature):${schema.description ? `\n    \"\"\"${schema.description}\"\"\"` : ""}${fields.length > 0 ? `\n${fields.join('\n')}` : '\n    pass'}`;

    // Add helpful comment about field types
    const helpComment = `# DSPy Signature: Fields ending with 'output', 'result', 'answer', etc. are treated as OutputFields\n# All other fields are treated as InputFields. Modify field types as needed for your use case.`;

    return `${imports.join('\n')}${nestedImports}\n\n${helpComment}\n${classDefinition}`;
  }, [getSchema]);

  const wouldIntroduceCycle = useCallback((rootId: string, candidateId: string): boolean => {
    if (rootId === candidateId) return true;
    const visited = new Set<string>();
    const stack = [candidateId];
    while (stack.length) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      if (id === rootId) return true;
      const s = getSchema(id);
      if (!s) continue;
      for (const f of s.fields) {
        if (f.objectSchemaId) stack.push(f.objectSchemaId);
        if (f.arrayItemSchemaId) stack.push(f.arrayItemSchemaId);
      }
    }
    return false;
  }, [getSchema]);

  const createSchema = useCallback(async (schema: Omit<CustomSchema, "id">): Promise<CustomSchema> => {
    const payload = {
      name: schema.name,
      description: schema.description,
      fields: schema.fields.map(fromSchemaField),
    };
    const saved = await api.createFlowSchema(flowId, payload);
    const cs = toCustomSchema(saved);
    setSchemas(prev => [cs, ...prev]);
    return cs;
  }, [flowId]);

  const updateSchema = useCallback(async (id: string, updates: Partial<Omit<CustomSchema, "id">>): Promise<CustomSchema> => {
    const existing = schemas.find(s => s.id === id);
    if (!existing) throw new Error("Schema not found");
    const merged: Omit<CustomSchema, "id"> = { ...existing, ...updates } as any;
    const payload = {
      name: merged.name,
      description: merged.description,
      fields: merged.fields.map(fromSchemaField),
    };
    const saved = await api.updateFlowSchema(flowId, id, payload);
    const cs = toCustomSchema(saved);
    setSchemas(prev => prev.map(s => (s.id === id ? cs : s)));
    return cs;
  }, [flowId, schemas]);

  const deleteSchema = useCallback(async (id: string): Promise<void> => {
    await api.deleteFlowSchema(flowId, id);
    setSchemas(prev => prev.filter(s => s.id != id));
  }, [flowId]);

  return {
    schemas,
    loading,
    error,
    refresh,
    getSchema,
    createSchema,
    updateSchema,
    deleteSchema,
    createField,
    validateSchema,
    exportToDSPy,
    wouldIntroduceCycle,
  };
}

function generateFieldId(): string {
  return `field_${Math.random().toString(36).slice(2, 9)}`;
}

