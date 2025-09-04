import type { TypedNodeData, Port, PortType } from "@/components/flowbuilder/types";

function pyType(t: PortType, arrayItemType?: PortType): string {
  switch (t) {
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
    case "array":
      if (arrayItemType === "string") return "list[str]";
      if (arrayItemType === "int") return "list[int]";
      if (arrayItemType === "float") return "list[float]";
      if (arrayItemType === "boolean") return "list[bool]";
      return "list";
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
  const t = pyType(p.type, p.arrayItemType);
  const desc = (p.description || "").replace(/"/g, '\\"');
  const field = isOutput ? "OutputField" : "InputField";
  return `    ${toIdentifier(p.name)}: ${t} = dspy.${field}(desc="${desc}")`;
}

export function generateDSPyCode(node: TypedNodeData): string {
  const className = toIdentifier(node.title || node.kind || "Node").replace(/^[a-z]/, (m) => m.toUpperCase());
  const doc = (node.description || "").replace(/"""/g, '"\"\"');
  const inputs = (node.inputs || []).filter((p) => !(p.type === "llm" && p.name === "model"));
  const outputs = node.outputs || [];
  const lines: string[] = [];
  lines.push("import dspy");
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
