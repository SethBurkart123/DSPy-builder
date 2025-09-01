"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function Topbar({ title, status = "idle", onBack }: { title: string; status?: SaveStatus; onBack?: () => void }) {
  return (
    <div className="fixed inset-x-0 top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-12 items-center gap-3 px-4">
        {onBack ? (
          <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} />
            Back
          </button>
        ) : (
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} />
            Back
          </Link>
        )}
        <div className="mx-2 h-4 w-px bg-border" />
        <h1 className="truncate text-sm font-semibold flex-1">{title}</h1>
        {status !== "idle" && (
          <span
            className="inline-flex items-center justify-center w-6 h-6"
            title={status === "saving" ? "Saving" : status === "saved" ? "Saved" : "Save failed; retrying"}
          >
            {status === "saving" && <RefreshCcw className="h-4 w-4 text-muted-foreground animate-spin" aria-label="Saving" />}
            {status === "saved" && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Saved" />}
            {status === "error" && <AlertCircle className="h-4 w-4 text-red-600" aria-label="Save failed" />}
          </span>
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}
