"use client";

import { Toaster } from "react-hot-toast";
import { useTheme } from "next-themes";

export function ToasterClient() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: dark ? "#0b1020" : "#ffffff",
          color: dark ? "#e5e7eb" : "#0f172a",
          border: `1px solid ${dark ? "#1f2937" : "#e5e7eb"}`,
        },
        success: {
          style: { background: dark ? "#062b1f" : "#ecfdf5", color: dark ? "#a7f3d0" : "#065f46" },
        },
        error: {
          style: { background: dark ? "#2b0d0d" : "#fef2f2", color: dark ? "#fecaca" : "#991b1b" },
        },
      }}
    />
  );
}

