import { CustomSchema, SchemaField, PortType } from "@/components/flowbuilder/types";

const SCHEMAS_STORAGE_KEY = "dspy_custom_schemas";

export class SchemaManager {
  private static instance: SchemaManager;
  private schemas: Map<string, CustomSchema> = new Map();

  private constructor() {
    this.loadSchemasFromStorage();
  }

  static getInstance(): SchemaManager {
    if (!SchemaManager.instance) {
      SchemaManager.instance = new SchemaManager();
    }
    return SchemaManager.instance;
  }

  private loadSchemasFromStorage(): void {
    if (typeof window === "undefined") return;
    
    try {
      const stored = localStorage.getItem(SCHEMAS_STORAGE_KEY);
      if (stored) {
        const schemas = JSON.parse(stored) as CustomSchema[];
        schemas.forEach((s) => this.schemas.set(s.id, s));
      }
    } catch (error) {
      console.error("Failed to load schemas from storage:", error);
    }
  }

  private saveToStorage(): void {
    if (typeof window === "undefined") return;
    
    try {
      const schemasArray = Array.from(this.schemas.values());
      localStorage.setItem(SCHEMAS_STORAGE_KEY, JSON.stringify(schemasArray));
    } catch (error) {
      console.error("Failed to save schemas to storage:", error);
    }
  }

  getAllSchemas(): CustomSchema[] {
    // Sort by name for stable ordering
    return Array.from(this.schemas.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  getSchema(id: string): CustomSchema | undefined {
    return this.schemas.get(id);
  }

  saveSchema(schema: Omit<CustomSchema, "id">): CustomSchema {
    const newSchema: CustomSchema = {
      ...schema,
      id: generateSchemaId(),
    };
    
    this.schemas.set(newSchema.id, newSchema);
    this.saveToStorage();
    return newSchema;
  }

  updateSchema(id: string, updates: Partial<Omit<CustomSchema, "id">>): CustomSchema | null {
    const existing = this.schemas.get(id);
    if (!existing) return null;

    const updated: CustomSchema = {
      ...existing,
      ...updates,
    };

    this.schemas.set(id, updated);
    this.saveToStorage();
    return updated;
  }

  deleteSchema(id: string): boolean {
    const deleted = this.schemas.delete(id);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  createField(name: string = "", type: PortType = "string"): SchemaField {
    return {
      id: generateFieldId(),
      name,
      type,
      required: true,
      description: "",
    };
  }

  // Detect whether adding `candidateId` under `rootId` would create a cycle
  wouldIntroduceCycle(rootId: string, candidateId: string): boolean {
    if (rootId === candidateId) return true;
    const visited = new Set<string>();
    const stack = [candidateId];
    while (stack.length) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      if (id === rootId) return true;
      const s = this.schemas.get(id);
      if (!s) continue;
      for (const f of s.fields) {
        if (f.objectSchemaId) stack.push(f.objectSchemaId);
        if (f.arrayItemSchemaId) stack.push(f.arrayItemSchemaId);
      }
    }
    return false;
  }

  // Schema validation
  validateSchema(schema: Omit<CustomSchema, "id">): string[] {
    const errors: string[] = [];
    
    if (!schema.name.trim()) {
      errors.push("Schema name is required");
    }

    if (schema.fields.length === 0) {
      errors.push("Schema must have at least one field");
    }

    schema.fields.forEach((field, index) => {
      if (!field.name.trim()) {
        errors.push(`Field ${index + 1}: Name is required`);
      }

      // Check for duplicate field names
      const duplicates = schema.fields.filter(f => f.name === field.name);
      if (duplicates.length > 1) {
        errors.push(`Field "${field.name}": Duplicate field names are not allowed`);
      }

      // Validate array type has item type
      if (field.type === "array" && !field.arrayItemType) {
        errors.push(`Field "${field.name}": Array type requires item type specification`);
      }

      // Validate object type has schema
      if (field.type === "object" && !field.objectSchemaId) {
        errors.push(`Field "${field.name}": Object type requires schema specification`);
      }
    });

    return errors;
  }

  // Export schema to DSPy-compatible format
  exportToDSPy(schema: CustomSchema): string {
    const fields = schema.fields.map(field => {
      let fieldDef = `${field.name}: `;
      
      switch (field.type) {
        case "string":
          fieldDef += "str";
          break;
        case "int":
          fieldDef += "int";
          break;
        case "float":
          fieldDef += "float";
          break;
        case "boolean":
          fieldDef += "bool";
          break;
        case "array":
          if (field.arrayItemType === "string") {
            fieldDef += "List[str]";
          } else if (field.arrayItemSchemaId) {
            const s = this.schemas.get(field.arrayItemSchemaId);
            fieldDef += `List[${s?.name || 'Any'}]`;
          } else {
            fieldDef += "List";
          }
          break;
        case "object":
          if (field.objectSchemaId) {
            const s = this.schemas.get(field.objectSchemaId);
            fieldDef += s?.name || "dict";
          } else {
            fieldDef += "dict";
          }
          break;
        default:
          fieldDef += "str";
      }

      if (field.description) {
        fieldDef += ` = Field(description="${field.description}")`;
      }

      return fieldDef;
    });

    return `class ${schema.name}(BaseModel):${schema.description ? `
    """${schema.description}"""` : ""}
    ${fields.join('\n    ')}`;
  }
}

function generateSchemaId(): string {
  return `schema_${Math.random().toString(36).slice(2, 9)}`;
}

function generateFieldId(): string {
  return `field_${Math.random().toString(36).slice(2, 9)}`;
}

export const schemaManager = SchemaManager.getInstance();
