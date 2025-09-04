import type { NodeKind, PortType, Port } from "@/components/flowbuilder/types";
import { genId } from "@/lib/flow-utils";

export type SectionType = "control_group" | "port_list" | "empty_spacer";

export type ControlType = "text" | "number" | "select" | "slider";

export interface ControlSpec {
  id: string;
  label?: string;
  type: ControlType;
  dataPath: string; // e.g., "llm.model"
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { label?: string; value: string }[];
  // Optional binding to an input port for inline override
  bind?: {
    inputPortName: string; // e.g., "model"
    portType?: PortType;   // e.g., "llm"
    hideWhenBound?: boolean;
    boundFlagPath?: string; // e.g., "llmConnected"
  };
}

export type SectionConfig =
  | {
      type: "port_list";
      id: string;
      role: "inputs" | "outputs";
      autogrow?: boolean;
      selectable?: boolean;
      title?: string;
      accepts?: PortType[];
      colSpan?: 1 | 2;
    }
  | {
      type: "control_group";
      id: string;
      controls: ControlSpec[];
      inline?: boolean;
      selectable?: boolean;
      title?: string;
      colSpan?: 1 | 2;
    }
  | {
      type: "empty_spacer";
      id: string;
      colSpan?: 1 | 2;
    };

export interface NodeDefinition {
  type: NodeKind;
  sections: SectionConfig[];
}

export const NodeRegistry: Record<NodeKind, NodeDefinition> = {
  predict: {
    type: "predict",
    sections: [
      {
        type: "control_group",
        id: "model",
        inline: true,
        selectable: true,
        colSpan: 2,
        controls: [
          {
            id: "llm-model",
            label: "Model",
            type: "text",
            dataPath: "llm.model",
            placeholder: "Model",
            bind: { inputPortName: "model", portType: "llm", hideWhenBound: true, boundFlagPath: "connected.inputsByName.model" },
          },
        ],
      },
      { type: "port_list", id: "inputs", role: "inputs", autogrow: true, selectable: true, title: "Inputs", colSpan: 1 },
      { type: "port_list", id: "outputs", role: "outputs", autogrow: true, selectable: true, title: "Outputs", colSpan: 1 },
    ],
  },
  agent: {
    type: "agent",
    sections: [
      {
        type: "control_group",
        id: "model",
        inline: true,
        selectable: true,
        colSpan: 2,
        controls: [
          {
            id: "llm-model",
            label: "Model",
            type: "text",
            dataPath: "llm.model",
            placeholder: "Model",
            bind: { inputPortName: "model", portType: "llm", hideWhenBound: true, boundFlagPath: "connected.inputsByName.model" },
          },
        ],
      },
      { type: "port_list", id: "inputs", role: "inputs", autogrow: true, selectable: true, title: "Inputs", colSpan: 1 },
      { type: "port_list", id: "outputs", role: "outputs", autogrow: false, selectable: true, title: "Outputs", colSpan: 1 },
    ],
  },
  tool_wikipedia: {
    type: "tool_wikipedia",
    sections: [
      { type: "empty_spacer", id: "left_spacer", colSpan: 1 },
      { type: "port_list", id: "outputs", role: "outputs", autogrow: false, selectable: true, title: "Outputs", colSpan: 1 },
    ],
  },
  tool_math: {
    type: "tool_math",
    sections: [
      { type: "empty_spacer", id: "left_spacer", colSpan: 1 },
      { type: "port_list", id: "outputs", role: "outputs", autogrow: false, selectable: true, title: "Outputs", colSpan: 1 },
    ],
  },
  tool_python: {
    type: "tool_python",
    sections: [
      { type: "empty_spacer", id: "left_spacer", colSpan: 1 },
      { type: "port_list", id: "outputs", role: "outputs", autogrow: false, selectable: true, title: "Outputs", colSpan: 1 },
    ],
  },
  chainofthought: {
    type: "chainofthought",
    sections: [
      {
        type: "control_group",
        id: "model",
        inline: true,
        selectable: true,
        colSpan: 2,
        controls: [
          {
            id: "llm-model",
            label: "Model",
            type: "text",
            dataPath: "llm.model",
            placeholder: "Model",
            bind: { inputPortName: "model", portType: "llm", hideWhenBound: true, boundFlagPath: "connected.inputsByName.model" },
          },
        ],
      },
      { type: "port_list", id: "inputs", role: "inputs", autogrow: true, selectable: true, title: "Inputs", colSpan: 1 },
      { type: "port_list", id: "outputs", role: "outputs", autogrow: true, selectable: true, title: "Outputs", colSpan: 1 },
    ],
  },
  input: {
    type: "input",
    sections: [
      { type: "empty_spacer", id: "left_spacer", colSpan: 1 },
      { type: "port_list", id: "outputs", role: "outputs", autogrow: true, selectable: true, title: "Outputs", colSpan: 1 },
    ],
  },
  output: {
    type: "output",
    sections: [
      { type: "port_list", id: "inputs", role: "inputs", autogrow: true, selectable: true, title: "Inputs", colSpan: 2 },
    ],
  },
  llm: {
    type: "llm",
    sections: [
      {
        type: "control_group",
        id: "provider",
        selectable: true,
        title: "LLM Provider",
        colSpan: 2,
        controls: [
          { id: "model", label: "Model", type: "text", dataPath: "llm.model", placeholder: "Model" },
          { id: "temperature", label: "Temp", type: "slider", dataPath: "llm.temperature", min: 0, max: 2, step: 0.01 },
          { id: "top_p", label: "Top P", type: "slider", dataPath: "llm.top_p", min: 0, max: 1, step: 0.01 },
          { id: "max_tokens", label: "Max Tok", type: "number", dataPath: "llm.max_tokens", step: 1 },
        ],
      },
      { type: "empty_spacer", id: "left_spacer", colSpan: 1 },
      { type: "port_list", id: "outputs", role: "outputs", autogrow: false, accepts: ["llm"], selectable: true, title: "Outputs", colSpan: 1 },
    ],
  },
};

// Helpers to pick sections for a node instance
export function getNodeDefinition(kind: NodeKind): NodeDefinition {
  return NodeRegistry[kind];
}

// Centralized defaults for node ports and data
export function buildNodeDefaults(
  kind: NodeKind,
  requiredInputType?: PortType
): { inputs: Port[]; outputs: Port[]; llm?: { model?: string; temperature?: number; top_p?: number; max_tokens?: number }; values?: Record<string, any> } {
  const makePort = (name: string, type: PortType): Port => ({ id: genId("p"), name, type, description: "" });

  let inputs: Port[] = [];
  let outputs: Port[] = [];
  let llm: { model?: string; temperature?: number; top_p?: number; max_tokens?: number } | undefined;
  let values: Record<string, any> | undefined;

  if (kind === "chainofthought") {
    inputs = [
      { ...makePort("model", "llm"), description: "LLM provider", locked: true },
      makePort("prompt", requiredInputType || "string"),
    ];
    outputs = [
      { ...makePort("reasoning", "string"), locked: true },
      makePort("output", "string"),
    ];
    llm = { model: "gemini/gemini-2.5-flash" };
  } else if (kind === "predict") {
    inputs = [
      { ...makePort("model", "llm"), description: "LLM provider", locked: true },
      makePort("prompt", requiredInputType || "string"),
    ];
    outputs = [makePort("output", "string")];
    llm = { model: "gemini/gemini-2.5-flash" };
  } else if (kind === "input") {
    inputs = [];
    outputs = [makePort("prompt", "string")];
  } else if (kind === "output") {
    inputs = [makePort("output", requiredInputType || "string")];
    outputs = [];
  } else if (kind === "llm") {
    inputs = [];
    outputs = [{ ...makePort("model", "llm"), description: "LLM provider output", locked: true }];
    llm = { model: "gemini/gemini-2.5-flash" };
  } else if (kind === "agent") {
    inputs = [
      { ...makePort("model", "llm"), description: "LLM provider", locked: true },
      { ...makePort("question", requiredInputType || "string"), locked: true },
      { ...makePort("tools", "tool"), description: "Attach tool nodes here (multi-input)", locked: true },
    ];
    outputs = [makePort("answer", "string")];
    llm = { model: "gemini/gemini-2.5-flash" };
  } else if (kind === "tool_wikipedia") {
    inputs = [];
    outputs = [{ ...makePort("tool", "tool"), description: "Wikipedia search tool", locked: true }];
  } else if (kind === "tool_math") {
    inputs = [];
    outputs = [{ ...makePort("tool", "tool"), description: "Math evaluation tool", locked: true }];
  } else if (kind === "tool_python") {
    inputs = [];
    outputs = [{ ...makePort("tool", "tool"), description: "Custom Python tool", locked: true }];
    values = {
      code:
        "def my_tool(input: str):\n    \"\"\"Implement your tool. Replace name/signature as needed.\n    \"\"\"\n    # TODO: implement\n    return input\n",
    };
  }

  return { inputs, outputs, llm, values };
}
