import type { TypedNodeData, Port, PortType } from "@/components/flowbuilder/types";

function pyType(p: Port): string {
  switch (p.type) {
    case "string":
      return "str";
    case "string[]":
      return "list[str]";
    case "boolean":
      return "bool";
    case "float":
      return "float";
    case "int":
      return "int";
    case "custom":
      return p.customType || 'str';
    case "literal":
      if (p.literalValues && p.literalValues.length > 0) {
        const vals = p.literalValues.map((v) => typeof v === 'string' ? `'${String(v).replace(/'/g, "\\'")}'` : String(v)).join(", ");
        return `Literal[${vals}]`;
      }
      if (p.literalKind === 'int') return 'int';
      if (p.literalKind === 'float') return 'float';
      if (p.literalKind === 'boolean') return 'bool';
      return 'str';
    case "array": {
      const t = p.arrayItemType;
      if (t === "string") return "list[str]";
      if (t === "int") return "list[int]";
      if (t === "float") return "list[float]";
      if (t === "boolean") return "list[bool]";
      if (t === "literal") {
        if (p.arrayItemLiteralValues && p.arrayItemLiteralValues.length > 0) {
          const vals = p.arrayItemLiteralValues.map((v) => typeof v === 'string' ? `'${String(v).replace(/'/g, "\\'")}'` : String(v)).join(", ");
          return `list[Literal[${vals}]]`;
        }
        if (p.arrayItemLiteralKind === 'int') return 'list[int]';
        if (p.arrayItemLiteralKind === 'float') return 'list[float]';
        if (p.arrayItemLiteralKind === 'boolean') return 'list[bool]';
        return 'list[str]';
      }
      if (t === "custom") return `list[${p.arrayItemCustomType || 'str'}]`;
      if (t === "object") return "list[dict]";
      return "list";
    }
    case "object":
      return "dict";
    case "llm":
      // internal-only; not part of signature
      return "str";
    default:
      return "str";
  }
}

function toIdentifier(name: string): string {
  // Simple sanitization to valid Python identifier
  const cleaned = name.replace(/[^a-zA-Z0-9_]/g, "_");
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `f_${cleaned}`;
}

function fieldLine(p: Port, isOutput: boolean): string {
  const t = pyType(p);
  const desc = (p.description || "").replace(/"/g, '\\"');
  const field = isOutput ? "OutputField" : "InputField";
  const optional = !isOutput && p.optional ? ", required=False" : "";
  return `    ${toIdentifier(p.name)}: ${t} = dspy.${field}(desc="${desc}"${optional})`;
}

export function generateDSPyCode(node: TypedNodeData): string {
  const className = toIdentifier(node.title || node.kind || "Node").replace(/^[a-z]/, (m) => m.toUpperCase());
  const doc = (node.description || "").replace(/"""/g, '"\"\"');
  const inputs = (node.inputs || []).filter((p) => !(p.type === "llm" && p.name === "model"));
  const outputs = node.outputs || [];
  const lines: string[] = [];
  lines.push("import dspy");
  lines.push("from typing import Literal");
  lines.push("");
  lines.push(`class ${className}(dspy.Signature):`);
  if (doc) lines.push(`    \"\"\"${doc}\"\"\"`);
  if (inputs.length === 0 && outputs.length === 0) {
    lines.push("    pass");
  } else {
    for (const p of inputs) lines.push(fieldLine(p, false));
    for (const p of outputs) lines.push(fieldLine(p, true));
  }
  lines.push("");
  const moduleCtor = node.kind === "chainofthought" ? "dspy.ChainOfThought" : (node.kind === "agent" ? "dspy.ReAct" : "dspy.Predict");
  const modelExpr = node.llm?.model ? `\"${node.llm.model}\"` : "None";
  lines.push("# Example usage");
  lines.push(`lm = dspy.LM(model=${modelExpr})`);
  lines.push("dspy.settings.configure(lm=lm)");
  if (node.kind === 'agent') {
    lines.push(`module = ${moduleCtor}(${className}, tools=[...])`);
  } else {
    lines.push(`module = ${moduleCtor}(${className})`);
  }
  const kwargs = inputs.map((p) => `${toIdentifier(p.name)}=...`).join(", ");
  lines.push(`pred = module(${kwargs})`);
  if (outputs.length) {
    const outs = outputs.map((p) => `pred.${toIdentifier(p.name)}`).join(", ");
    lines.push(`# outputs: ${outs}`);
  }
  return lines.join("\n");
}
