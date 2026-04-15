"use client"

import { useEffect, useState, useTransition } from "react"
import { MoonStar, SunMedium } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  label: string
  lightLabel: string
  darkLabel: string
  className?: string
}

export function ThemeToggle({
  label,
  lightLabel,
  darkLabel,
  className,
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = mounted && resolvedTheme === "light" ? "light" : "dark"

  function handleThemeChange(nextTheme: "light" | "dark") {
    startTransition(() => {
      setTheme(nextTheme)
    })
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border/60 bg-card/70 p-1 shadow-sm backdrop-blur",
        className,
      )}
    >
      <span className="px-2 text-xs text-muted-foreground">
        {label}
      </span>
      <button
        type="button"
        onClick={() => handleThemeChange("light")}
        aria-pressed={activeTheme === "light"}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
          activeTheme === "light"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <SunMedium className="h-3.5 w-3.5" />
        {lightLabel}
      </button>
      <button
        type="button"
        onClick={() => handleThemeChange("dark")}
        aria-pressed={activeTheme === "dark"}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
          activeTheme === "dark"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <MoonStar className="h-3.5 w-3.5" />
        {darkLabel}
      </button>
    </div>
  )
}
