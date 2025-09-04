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
    customType: (f as any).customType || undefined,
    arrayItemCustomType: (f as any).arrayItemCustomType || undefined,
    literalKind: (f as any).literalKind || undefined,
    literalValues: (f as any).literalValues || undefined,
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
    customType: f.customType || null,
    arrayItemCustomType: f.arrayItemCustomType || null,
    literalKind: f.literalKind || null,
    literalValues: f.literalValues || null,
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
      if (field.type === "array") {
        if (!field.arrayItemType) errors.push(`Field "${field.name}": Array type requires item type specification`);
        if (field.arrayItemType === 'object' && !field.arrayItemSchemaId) errors.push(`Field "${field.name}": Array of objects requires a schema`);
        if (field.arrayItemType === 'custom' && !(field.arrayItemCustomType || '').trim()) errors.push(`Field "${field.name}": Array of custom types requires a type string`);
      }
      if (field.type === "object" && !field.objectSchemaId) errors.push(`Field "${field.name}": Object type requires schema specification`);
      if (field.type === 'custom' && !(field.customType || '').trim()) errors.push(`Field "${field.name}": Custom type requires a type string`);
      if (field.type === 'literal') {
        if (!field.literalKind) errors.push(`Field "${field.name}": Literal requires a base kind`);
        if (!field.literalValues || field.literalValues.length === 0) errors.push(`Field "${field.name}": Literal requires at least one value`);
      }
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
        case "custom": return field.customType || 'Any';
        case "literal":
          if (field.literalValues && field.literalValues.length > 0) {
            const vals = field.literalValues.map(v => typeof v === 'string' ? `'${String(v).replace(/'/g, "\\'")}'` : String(v)).join(', ');
            return `Literal[${vals}]`;
          }
          return field.literalKind === 'string' ? 'str' : field.literalKind === 'int' ? 'int' : field.literalKind === 'float' ? 'float' : 'bool';
        case "array":
          if (field.arrayItemType === "string") {
            return "List[str]";
          } else if (field.arrayItemType === "int") {
            return "List[int]";
          } else if (field.arrayItemType === "float") {
            return "List[float]";
          } else if (field.arrayItemType === "boolean") {
            return "List[bool]";
          } else if (field.arrayItemType === 'custom') {
            return `List[${field.arrayItemCustomType || 'Any'}]`;
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

    const fieldsFor = (s: CustomSchema) => s.fields.map(field => {
      const dspyType = getDSPyType(field);
      const description = field.description;
      
      // Determine if this should be an InputField or OutputField based on common naming patterns
      // Fields ending with "output", "result", "answer", "response" are typically outputs
      const isLikelyOutput = /^(output|result|answer|response|conclusion|summary|prediction|score)(_|$)/i.test(field.name) ||
                           /_(output|result|answer|response|conclusion|summary|prediction|score)$/i.test(field.name);
      
      const fieldType = isLikelyOutput ? "OutputField" : "InputField";
      
      // Generate field with proper DSPy syntax
      let fieldDeclaration = `${field.name}: ${dspyType} = dspy.${fieldType}(${description ? `desc="${description}"` : ""}`;
      
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
      "from typing import List, Optional, Literal"
    ];

    // Collect dependency graph and emit nested schemas first
    const byId = new Map<string, CustomSchema>();
    schemas.forEach(s => byId.set(s.id, s));

    const depIds = new Set<string>();
    const visitCollect = (s: CustomSchema) => {
      for (const f of s.fields) {
        if (f.objectSchemaId) {
          depIds.add(f.objectSchemaId);
          const child = byId.get(f.objectSchemaId);
          if (child) visitCollect(child);
        }
        if (f.arrayItemSchemaId) {
          depIds.add(f.arrayItemSchemaId);
          const child = byId.get(f.arrayItemSchemaId);
          if (child) visitCollect(child);
        }
      }
    };
    visitCollect(schema);

    // Emit classes in DFS order so dependencies appear before use
    const emitted = new Set<string>();
    const out: string[] = [];
    const emitClass = (s: CustomSchema) => {
      if (emitted.has(s.id)) return;
      // Emit dependencies first
      for (const f of s.fields) {
        if (f.objectSchemaId) {
          const child = byId.get(f.objectSchemaId);
          if (child) emitClass(child);
        }
        if (f.arrayItemSchemaId) {
          const child = byId.get(f.arrayItemSchemaId);
          if (child) emitClass(child);
        }
      }
      const fields = fieldsFor(s);
      const classDef = `class ${s.name}(dspy.Signature):${s.description ? `\n    \"\"\"${s.description}\"\"\"` : ""}${fields.length > 0 ? `\n${fields.join('\n')}` : '\n    pass'}`;
      out.push(classDef);
      emitted.add(s.id);
    };
    emitClass(schema);

    return `${imports.join('\n')}\n\n${out.join('\n\n')}`;
  }, [getSchema, schemas]);

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
