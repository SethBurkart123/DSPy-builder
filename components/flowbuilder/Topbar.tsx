"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function Topbar({ title }: { title: string }) {
  return (
    <div className="fixed inset-x-0 top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} />
          Back
        </Link>
        <div className="mx-2 h-4 w-px bg-border" />
        <h1 className="truncate text-sm font-semibold">{title}</h1>
      </div>
    </div>
  );
}

