import { CustomSchema, SchemaField, PortType } from "@/components/flowbuilder/types";
import { isValidPythonIdentifier, getPythonIdentifierError } from "./python-identifier-utils";

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
        schemas.forEach(schema => {
          // Convert date strings back to Date objects
          schema.createdAt = new Date(schema.createdAt);
          schema.updatedAt = new Date(schema.updatedAt);
          this.schemas.set(schema.id, schema);
        });
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
    return Array.from(this.schemas.values()).sort((a, b) => 
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  getSchema(id: string): CustomSchema | undefined {
    return this.schemas.get(id);
  }

  saveSchema(schema: Omit<CustomSchema, "id" | "createdAt" | "updatedAt">): CustomSchema {
    const now = new Date();
    const newSchema: CustomSchema = {
      ...schema,
      id: generateSchemaId(),
      createdAt: now,
      updatedAt: now,
    };
    
    this.schemas.set(newSchema.id, newSchema);
    this.saveToStorage();
    return newSchema;
  }

  updateSchema(id: string, updates: Partial<Omit<CustomSchema, "id" | "createdAt">>): CustomSchema | null {
    const existing = this.schemas.get(id);
    if (!existing) return null;

    const updated: CustomSchema = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
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

  // Schema validation
  validateSchema(schema: Omit<CustomSchema, "id" | "createdAt" | "updatedAt">): string[] {
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
      if (field.type === "object" && !field.objectSchema) {
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
          } else if (field.arrayItemSchema) {
            fieldDef += `List[${field.arrayItemSchema.name}]`;
          } else {
            fieldDef += "List";
          }
          break;
        case "object":
          fieldDef += field.objectSchema?.name || "dict";
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
