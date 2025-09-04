"use client"

import * as React from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="Theme">
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("system")} className="flex items-center gap-2">
          <Monitor className="h-4 w-4" /> System
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("light")} className="flex items-center gap-2">
          <Sun className="h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="flex items-center gap-2">
          <Moon className="h-4 w-4" /> Dark
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

