import { CustomSchema } from "@/components/flowbuilder/types";
import { schemaManager } from "./schema-manager";

export function createDemoSchemas() {
  // Only create demo schemas if none exist
  if (schemaManager.getAllSchemas().length > 0) {
    return;
  }

  // Answer schema - common for Q&A tasks
  const answerSchema = schemaManager.saveSchema({
    name: "Answer",
    description: "A structured answer with confidence and reasoning",
    fields: [
      {
        id: `field_${Math.random().toString(36).slice(2, 9)}`,
        name: "text",
        type: "string",
        description: "The main answer text",
        required: true,
      },
      {
        id: `field_${Math.random().toString(36).slice(2, 9)}`,
        name: "confidence",
        type: "float",
        description: "Confidence score between 0.0 and 1.0",
        required: true,
      },
      {
        id: `field_${Math.random().toString(36).slice(2, 9)}`,
        name: "reasoning",
        type: "string",
        description: "Step-by-step reasoning that led to this answer",
        required: false,
      },
      {
        id: `field_${Math.random().toString(36).slice(2, 9)}`,
        name: "sources",
        type: "array",
        arrayItemType: "string",
        description: "List of source references used",
        required: false,
      },
    ],
  });

  // Document Analysis schema
  schemaManager.saveSchema({
    name: "DocumentAnalysis",
    description: "Comprehensive analysis of a document",
    fields: [
      {
        id: `field_${Math.random().toString(36).slice(2, 9)}`,
        name: "summary",
        type: "string",
        description: "Brief summary of the document",
        required: true,
      },
      {
        id: `field_${Math.random().toString(36).slice(2, 9)}`,
        name: "key_points",
        type: "array",
        arrayItemType: "string",
        description: "List of key points extracted from the document",
        required: true,
      },
      {
        id: `field_${Math.random().toString(36).slice(2, 9)}`,
        name: "sentiment",
        type: "string",
        description: "Overall sentiment: positive, negative, or neutral",
        required: false,
      },
      {
        id: `field_${Math.random().toString(36).slice(2, 9)}`,
        name: "entities",
        type: "array",
        arrayItemType: "string",
        description: "Named entities found in the document",
        required: false,
      },
      {
        id: `field_${Math.random().toString(36).slice(2, 9)}`,
        name: "topics",
        type: "array",
        arrayItemType: "string",
        description: "Main topics covered in the document",
        required: false,
      },
    ],
  });

  // User Profile schema
  schemaManager.saveSchema({
    name: "UserProfile",
    description: "User profile information extracted from text",
    fields: [
      {
        id: `field_${Math.random().toString(36).slice(2, 9)}`,
        name: "name",
        type: "string",
        description: "Full name of the user",
        required: true,
      },
      {
        id: `field_${Math.random().toString(36).slice(2, 9)}`,
        name: "email",
        type: "string",
        description: "Email address",
        required: false,
      },
      {
        id: `field_${Math.random().toString(36).slice(2, 9)}`,
        name: "interests",
        type: "array",
        arrayItemType: "string",
        description: "List of user interests or hobbies",
        required: false,
      },
      {
        id: `field_${Math.random().toString(36).slice(2, 9)}`,
        name: "is_verified",
        type: "boolean",
        description: "Whether the user profile has been verified",
        required: false,
      },
    ],
  });

  console.log("Demo schemas created successfully!");
}
