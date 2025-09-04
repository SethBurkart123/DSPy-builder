"use client";

import { ReactNode } from "react";
import { Type, List, ToggleLeft, Hash, Binary, Package, Layers, Brain, Wrench } from "lucide-react";
import type { PortType } from "./types";

// Shared helpers for displaying PortType labels and icons consistently

export function typeLabel(t: PortType | string): string {
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
      return "Custom Object";
    case "array":
      return "Array";
    case "llm":
      return "LLM Provider";
    case "tool":
      return "Tool";
    default:
      return String(t);
  }
}

export function typeIcon(t: PortType | string, className = "h-3 w-3"): ReactNode {
  switch (t) {
    case "string":
      return <Type className={className} />;
    case "string[]":
      return <List className={className} />;
    case "boolean":
      return <ToggleLeft className={className} />;
    case "float":
      return <Hash className={className} />;
    case "int":
      return <Binary className={className} />;
    case "object":
      return <Package className={className} />;
    case "array":
      return <Layers className={className} />;
    case "llm":
      return <Brain className={className} />;
    case "tool":
      return <Wrench className={className} />;
    default:
      return <Type className={className} />;
  }
}
