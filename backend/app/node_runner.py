from __future__ import annotations

import json
import sys
from typing import Any
import dspy
from .dspy_signature import build_signature
from .runner_core import get_lm, parse_tools, build_module, collect_outputs

 


def run(payload: dict) -> dict:
    kind = payload.get("node_kind")
    title = payload.get("node_title") or kind or "Node"
    desc = payload.get("node_description")
    inputs_schema = payload.get("inputs_schema") or []
    outputs_schema = payload.get("outputs_schema") or []
    inputs_values = payload.get("inputs_values") or {}
    model = payload.get("model")
    lm_params = payload.get("lm_params") or {}
    tools_code = payload.get("tools_code") or []

    try:
        Sig = build_signature(title.replace(" ", "_"), desc, inputs_schema, outputs_schema)
        lm = get_lm(model, lm_params)
        dspy.settings.configure(lm=lm)

        tools: list[Any] | None = None
        if kind == "agent":
            tools, errors = parse_tools(tools_code or [])
            if errors:
                return {"error": "; ".join(errors)}

        module = build_module(kind, Sig, tools=tools)
        pred = module(**inputs_values)

        outputs = collect_outputs(pred, outputs_schema)
        reasoning = getattr(pred, "reasoning", None)
        return {"outputs": outputs, "reasoning": reasoning}
    except Exception as e:
        return {"error": str(e)}


def main():
    data = sys.stdin.read()
    try:
        payload = json.loads(data)
    except Exception as e:
        print(json.dumps({"error": f"Invalid payload: {e}"}))
        return 1
    result = run(payload)
    print(json.dumps(result))
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
