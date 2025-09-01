"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  resolvedTheme: "light" | "dark";
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children, defaultTheme = "system" as ThemeMode }: { children: React.ReactNode; defaultTheme?: ThemeMode }) {
  const [theme, setTheme] = useState<ThemeMode>(defaultTheme);
  const [systemDark, setSystemDark] = useState<boolean>(getSystemPrefersDark());

  // Load persisted theme on first mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark" || stored === "system") {
        setTheme(stored);
      }
    } catch {}
  }, []);

  // Watch system preference
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mql.matches);
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else if ((mql as any).addListener) (mql as any).addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else if ((mql as any).removeListener) (mql as any).removeListener(onChange);
    };
  }, []);

  // Persist selected theme
  useEffect(() => {
    try {
      localStorage.setItem("theme", theme);
      // also set a cookie so SSR can read initial theme
      const maxAge = 60 * 60 * 24 * 365; // 1 year
      document.cookie = `theme=${theme}; path=/; max-age=${maxAge}`;
    } catch {}
  }, [theme]);

  const resolvedTheme: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // Apply class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [resolvedTheme]);

  const value = useMemo(() => ({ theme, setTheme, resolvedTheme }), [theme, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
