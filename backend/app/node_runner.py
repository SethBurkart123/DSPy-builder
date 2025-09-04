from __future__ import annotations

import json
import sys
from typing import Any
import ast
import dspy

def _py_type(t: str, array_item_type: str | None = None):
    t = t.lower()
    if t == "string":
        return str
    if t == "string[]":
        return list[str]
    if t == "boolean":
        return bool
    if t == "float":
        return float
    if t == "int":
        return int
    if t == "array":
        if array_item_type == "string":
            return list[str]
        if array_item_type == "int":
            return list[int]
        if array_item_type == "float":
            return list[float]
        if array_item_type == "boolean":
            return list[bool]
        return list
    if t == "object":
        return dict
    # internal-only type: treat as string for annotation
    if t == "llm":
        return str
    if t == "tool":
        # not part of signature (skipped), but default to object
        return dict
    return str


def build_signature(signature_name: str, description: str | None, inputs_schema: list[dict], outputs_schema: list[dict]):

    annotations: dict[str, Any] = {}
    attrs: dict[str, Any] = {}
    if description:
        attrs["__doc__"] = description

    # inputs
    for f in inputs_schema:
        if f.get("type") in {"llm", "tool"}:
            continue  # not part of signature
        name = f["name"]
        annotations[name] = _py_type(f.get("type", "string"))
        attrs[name] = getattr(__import__("dspy"), "InputField")(desc=f.get("description") or "")

    # outputs
    for f in outputs_schema:
        name = f["name"]
        annotations[name] = _py_type(f.get("type", "string"))
        attrs[name] = getattr(__import__("dspy"), "OutputField")(desc=f.get("description") or "")

    attrs["__annotations__"] = annotations
    Sig = type(signature_name, (getattr(__import__("dspy"), "Signature"),), attrs)
    return Sig


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
        # configure LM
        if model:
            lm = dspy.LM(model=model, **lm_params)
        else:
            lm = dspy.LM()
        dspy.settings.configure(lm=lm)

        if kind == "chainofthought":
            module = dspy.ChainOfThought(Sig)
        elif kind == "agent":
            # Build tools by executing provided code strings and collecting callables
            tool_funcs = []
            errors: list[str] = []
            for idx, code in enumerate(tools_code):
                # Basic structure validation via AST
                try:
                    tree = ast.parse(code)
                except Exception as e:
                    errors.append(f"Tool #{idx+1} parse error: {e}")
                    continue
                has_func = any(isinstance(n, ast.FunctionDef) for n in tree.body)
                if not has_func:
                    errors.append(f"Tool #{idx+1} must define at least one function (def ...)")
                    continue
                try:
                    ns: dict[str, Any] = {"dspy": dspy}
                    exec(compile(tree, filename=f"<tool_{idx+1}>", mode="exec"), ns, ns)
                    fns = [v for k, v in ns.items() if callable(v) and not k.startswith("__")]
                    if not fns:
                        errors.append(f"Tool #{idx+1} did not define any callable functions")
                        continue
                    tool_funcs.append(fns[-1])
                except Exception as e:
                    errors.append(f"Tool #{idx+1} execution error: {e}")
                    continue
            if errors:
                return {"error": "; ".join(errors)}
            if not tool_funcs:
                return {"error": "Agent requires at least one valid tool"}
            module = dspy.ReAct(Sig, tools=tool_funcs)
        else:
            module = dspy.Predict(Sig)

        pred = module(**inputs_values)

        outputs: dict[str, Any] = {}
        for f in outputs_schema:
            name = f.get("name")
            try:
                outputs[name] = getattr(pred, name)
            except Exception:
                outputs[name] = None

        # try to capture reasoning if present
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
