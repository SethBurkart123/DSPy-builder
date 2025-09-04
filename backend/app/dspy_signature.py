from __future__ import annotations

from typing import Any


def py_type(t: str, array_item_type: str | None = None):
    t = (t or "string").lower()
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
    # Internal-only DSPY builder types: not part of signature at runtime
    if t == "llm":
        return str
    if t == "tool":
        return dict
    return str


def build_signature(signature_name: str, description: str | None, inputs_schema: list[dict], outputs_schema: list[dict]):
    """Create a DSPy Signature class from simple field schemas.

    Skips internal-only input types like 'llm' and 'tool'.
    """
    annotations: dict[str, Any] = {}
    attrs: dict[str, Any] = {}
    if description:
        attrs["__doc__"] = description

    # Inputs
    for f in inputs_schema:
        if f.get("type") in {"llm", "tool"}:
            continue
        name = f["name"]
        annotations[name] = py_type(f.get("type", "string"), f.get("arrayItemType"))
        attrs[name] = getattr(__import__("dspy"), "InputField")(desc=f.get("description") or "")

    # Outputs
    for f in outputs_schema:
        name = f["name"]
        annotations[name] = py_type(f.get("type", "string"), f.get("arrayItemType"))
        attrs[name] = getattr(__import__("dspy"), "OutputField")(desc=f.get("description") or "")

    attrs["__annotations__"] = annotations
    Sig = type(signature_name, (getattr(__import__("dspy"), "Signature"),), attrs)
    return Sig
