"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";

// Dynamically import Monaco Editor to ensure client-side rendering only
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
}) as any;

export function CodeEditor({
  value,
  onChange,
  language = "python",
  height = 240,
  options,
  readOnly = false,
}: {
  value: string;
  onChange: (val: string) => void;
  language?: string;
  height?: number | string;
  options?: Record<string, any>;
  readOnly?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const [themeData, setThemeData] = useState<any | null>(null);

  // Load One Dark Pro Darker when in dark mode
  useEffect(() => {
    let cancelled = false;
    if (resolvedTheme === "dark") {
      fetch("/Blackboard.json")
        .then((r) => r.json())
        .then((j) => {
          if (!cancelled) setThemeData(j);
        })
        .catch(() => {
          if (!cancelled) setThemeData(null);
        });
    } else {
      setThemeData(null);
    }
    return () => {
      cancelled = true;
    };
  }, [resolvedTheme]);

  const editorOpts = useMemo(
    () => ({
      minimap: { enabled: false },
      wordWrap: "on",
      fontSize: 12,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      lineNumbers: "off",
      glyphMargin: false,
      readOnly,
      domReadOnly: readOnly,
      readOnlyMessage: readOnly ? { value: "Read-only" } : undefined,
      showFoldingControls: "never",
      ...options,
    }),
    [options, readOnly]
  );

  return (
    <div className="rounded border overflow-hidden" style={{ height: height }}>
      <MonacoEditor
        height={height}
        language={language}
        theme={resolvedTheme === "dark" ? (themeData ? "blackboard" : "vs-dark") : "vs-light"}
        value={value}
        onChange={(v: string | undefined) => onChange(v || "")}
        options={editorOpts}
        beforeMount={(monaco: any) => {
          monacoRef.current = monaco;
          if (themeData) {
            monaco.editor.defineTheme("blackboard", themeData);
          }
        }}
        onMount={(editor: any, monaco: any) => {
          editorRef.current = editor;
          if (themeData) {
            monaco.editor.defineTheme("blackboard", themeData);
            monaco.editor.setTheme("blackboard");
          }
        }}
      />
    </div>
  );
}
