import type { NodeKind, PortType } from "@/components/flowbuilder/types";

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
