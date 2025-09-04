from __future__ import annotations

import json
import time
from typing import Any, Callable

from dspy.utils.callback import BaseCallback

def _now_ms() -> int:
    return int(time.time() * 1000)


class StreamingCallback(BaseCallback):
    """
    Minimal DSPy callback that emits structured JSON events via a provided emitter.

    The emitter is a callable that accepts a JSON-serializable dict. Typical usage
    is to print a single line of JSON with flush=True so a parent process can parse
    line-delimited events.
    """

    def __init__(self, emit: Callable[[dict[str, Any]], None], run_id: str, node_meta: dict[str, Any] | None = None):
        super().__init__()
        self._emit = emit
        self._run_id = run_id
        self._node_meta = node_meta or {}

    # ---- Module lifecycle ----
    def on_module_start(self, call_id, inputs):
        self._emit({
            "event": "module_start",
            "ts": _now_ms(),
            "run_id": self._run_id,
            "node": self._node_meta,
            "call_id": str(call_id),
            "inputs": _safe_json(inputs),
        })

    def on_module_end(self, call_id, outputs, exception):
        self._emit({
            "event": "module_end",
            "ts": _now_ms(),
            "run_id": self._run_id,
            "node": self._node_meta,
            "call_id": str(call_id),
            "outputs": _safe_json(outputs),
            "exception": _safe_str(exception),
        })

    # ---- LM calls ----
    def on_lm_start(self, call_id, prompt, **kwargs):
        self._emit({
            "event": "lm_start",
            "ts": _now_ms(),
            "run_id": self._run_id,
            "node": self._node_meta,
            "call_id": str(call_id),
            "prompt": _safe_str(prompt),
            "params": _safe_json(kwargs),
        })

    def on_lm_end(self, call_id, response, exception=None, **kwargs):
        self._emit({
            "event": "lm_end",
            "ts": _now_ms(),
            "run_id": self._run_id,
            "node": self._node_meta,
            "call_id": str(call_id),
            "response": _safe_str(response),
            "exception": _safe_str(exception),
            "meta": _safe_json(kwargs),
        })

    # ---- Tool calls (when DSPy wraps as Tool) ----
    def on_tool_start(self, call_id, tool, inputs):
        self._emit({
            "event": "tool_start",
            "ts": _now_ms(),
            "run_id": self._run_id,
            "node": self._node_meta,
            "call_id": str(call_id),
            "tool": _safe_str(getattr(tool, "name", getattr(tool, "__name__", str(tool)))),
            "inputs": _safe_json(inputs),
        })

    def on_tool_end(self, call_id, tool, output, exception):
        self._emit({
            "event": "tool_end",
            "ts": _now_ms(),
            "run_id": self._run_id,
            "node": self._node_meta,
            "call_id": str(call_id),
            "tool": _safe_str(getattr(tool, "name", getattr(tool, "__name__", str(tool)))),
            "output": _safe_json(output),
            "exception": _safe_str(exception),
        })


def _safe_json(x: Any) -> Any:
    try:
        json.dumps(x)
        return x
    except Exception:
        try:
            return str(x)
        except Exception:
            return None


def _safe_str(x: Any) -> str | None:
    if x is None:
        return None
    try:
        return str(x)
    except Exception:
        return None

