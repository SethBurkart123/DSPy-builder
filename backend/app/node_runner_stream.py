from __future__ import annotations

import ast
import json
import os
import sys
import traceback
import uuid
from typing import Any

import dspy

from .dspy_streaming import StreamingCallback
from .dspy_signature import build_signature


def _emit(obj: dict[str, Any]):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def wrap_tool(fn, run_id: str, node_meta: dict[str, Any], index: int | None = None):
    name = getattr(fn, "__name__", str(fn))

    def _wrapped(*args, **kwargs):
        _emit({
            "event": "tool_start",
            "run_id": run_id,
            "node": node_meta,
            "tool": name,
            "tool_index": index,
            "inputs": {"args": args, "kwargs": kwargs},
        })
        try:
            out = fn(*args, **kwargs)
            _emit({
                "event": "tool_end",
                "run_id": run_id,
                "node": node_meta,
                "tool": name,
                "tool_index": index,
                "output": out,
                "exception": None,
            })
            return out
        except Exception as e:  # pragma: no cover
            _emit({
                "event": "tool_end",
                "run_id": run_id,
                "node": node_meta,
                "tool": name,
                "tool_index": index,
                "output": None,
                "exception": str(e),
            })
            raise

    _wrapped.__name__ = name
    return _wrapped


def run_stream(payload: dict) -> int:
    run_id = str(uuid.uuid4())

    kind = payload.get("node_kind")
    title = payload.get("node_title") or kind or "Node"
    desc = payload.get("node_description")
    inputs_schema = payload.get("inputs_schema") or []
    outputs_schema = payload.get("outputs_schema") or []
    inputs_values = payload.get("inputs_values") or {}
    model = payload.get("model")
    lm_params = payload.get("lm_params") or {}
    tools_code = payload.get("tools_code") or []
    node_id = payload.get("node_id")

    node_meta = {"id": node_id, "title": title, "kind": kind}

    _emit({"event": "run_start", "run_id": run_id, "node": node_meta})

    try:
        Sig = build_signature(title.replace(" ", "_"), desc, inputs_schema, outputs_schema)

        # Configure LM + callbacks
        if model:
            lm = dspy.LM(model=model, **lm_params)
        else:
            lm = dspy.LM()

        callback = StreamingCallback(_emit, run_id=run_id, node_meta=node_meta)
        dspy.settings.configure(lm=lm, callbacks=[callback])

        # Build module and tools
        if kind == "chainofthought":
            module = dspy.ChainOfThought(Sig)
        elif kind == "agent":
            tool_funcs = []
            errors: list[str] = []
            for idx, code in enumerate(tools_code):
                try:
                    tree = ast.parse(code)
                except Exception as e:
                    errors.append(f"Tool #{idx+1} parse error: {e}")
                    continue
                if not any(getattr(n, "name", None) and hasattr(n, "args") for n in tree.body):
                    errors.append(f"Tool #{idx+1} must define at least one function (def ...)")
                    continue
                try:
                    ns: dict[str, Any] = {"dspy": dspy}
                    exec(compile(tree, filename=f"<tool_{idx+1}>", mode="exec"), ns, ns)
                    fns = [v for k, v in ns.items() if callable(v) and not k.startswith("__")]
                    if not fns:
                        errors.append(f"Tool #{idx+1} did not define any callable functions")
                        continue
                    tool_funcs.append(wrap_tool(fns[-1], run_id, node_meta, idx))
                except Exception as e:
                    errors.append(f"Tool #{idx+1} execution error: {e}")
                    continue
            if errors:
                _emit({"event": "error", "run_id": run_id, "node": node_meta, "message": "; ".join(errors)})
                return 1
            if not tool_funcs:
                _emit({"event": "error", "run_id": run_id, "node": node_meta, "message": "Agent requires at least one valid tool"})
                return 1
            module = dspy.ReAct(Sig, tools=tool_funcs)
        else:
            module = dspy.Predict(Sig)

        # Execute
        pred = module(**inputs_values)

        outputs: dict[str, Any] = {}
        for f in outputs_schema:
            name = f.get("name")
            try:
                outputs[name] = getattr(pred, name)
            except Exception:
                outputs[name] = None

        reasoning = getattr(pred, "reasoning", None)
        _emit({"event": "result", "run_id": run_id, "node": node_meta, "outputs": outputs, "reasoning": reasoning})
        _emit({"event": "run_end", "run_id": run_id, "node": node_meta})
        return 0
    except Exception as e:  # pragma: no cover
        _emit({
            "event": "error",
            "run_id": run_id,
            "node": node_meta,
            "message": str(e),
            "traceback": traceback.format_exc(),
        })
        return 1


def main():
    data = sys.stdin.read()
    try:
        payload = json.loads(data)
    except Exception as e:
        _emit({"event": "error", "message": f"Invalid payload: {e}"})
        return 1
    code = run_stream(payload)
    return code


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
