from __future__ import annotations

import ast
from typing import Any, Callable, Iterable

import dspy


def get_lm(model: str | None, lm_params: dict | None) -> Any:
    """Return a configured dspy.LM instance.

    Falls back to default provider when `model` is None.
    """
    params = lm_params or {}
    if model:
        return dspy.LM(model=model, **params)
    return dspy.LM()


def _discover_functions(ns: dict[str, Any]) -> list[Callable[..., Any]]:
    return [v for k, v in ns.items() if callable(v) and not k.startswith("__")]


def parse_tools(
    tools_code: Iterable[str],
    *,
    wrap: Callable[[Callable[..., Any], int], Callable[..., Any]] | None = None,
) -> tuple[list[Callable[..., Any]], list[str]]:
    """Parse a list of Python code strings into callables for use as tools.

    - Validates each snippet parses and defines at least one function
    - Executes in an isolated namespace containing `dspy`
    - If `wrap` is provided, applies it to the last discovered function with its index
    - Returns (tools, errors)
    """
    tools: list[Callable[..., Any]] = []
    errors: list[str] = []

    for idx, code in enumerate(tools_code):
        try:
            tree = ast.parse(code)
        except Exception as e:
            errors.append(f"Tool #{idx+1} parse error: {e}")
            continue

        # Require at least one function definition
        has_func = any(getattr(n, "name", None) and hasattr(n, "args") for n in tree.body)
        if not has_func:
            errors.append(f"Tool #{idx+1} must define at least one function (def ...)")
            continue

        try:
            ns: dict[str, Any] = {"dspy": dspy}
            exec(compile(tree, filename=f"<tool_{idx+1}>", mode="exec"), ns, ns)
            fns = _discover_functions(ns)
            if not fns:
                errors.append(f"Tool #{idx+1} did not define any callable functions")
                continue
            fn = fns[-1]
            if wrap:
                fn = wrap(fn, idx)
            tools.append(fn)
        except Exception as e:
            errors.append(f"Tool #{idx+1} execution error: {e}")
            continue

    return tools, errors


def build_module(kind: str, Sig: Any, *, tools: list[Callable[..., Any]] | None = None) -> Any:
    """Create an appropriate DSPy module for the node kind.

    - chainofthought -> ChainOfThought(Sig)
    - agent -> ReAct(Sig, tools=tools)
    - default -> Predict(Sig)
    """
    if kind == "chainofthought":
        return dspy.ChainOfThought(Sig)
    if kind == "agent":
        if not tools:
            raise ValueError("Agent requires at least one valid tool")
        return dspy.ReAct(Sig, tools=tools)
    return dspy.Predict(Sig)


def collect_outputs(pred: Any, outputs_schema: list[dict]) -> dict[str, Any]:
    """Extract declared outputs from a DSPy prediction object safely."""
    out: dict[str, Any] = {}
    for f in outputs_schema:
        name = f.get("name")
        try:
            out[name] = getattr(pred, name)
        except Exception:
            out[name] = None
    return out

