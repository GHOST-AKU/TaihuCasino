"use client"

import { Languages } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Language } from "@/lib/home-content"
import { cn } from "@/lib/utils"

interface LanguageToggleProps {
  value: Language
  onChange: (language: Language) => void
  label: string
  className?: string
}

export function LanguageToggle({
  value,
  onChange,
  label,
  className,
}: LanguageToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border/60 bg-card/70 p-1 shadow-sm backdrop-blur",
        className,
      )}
    >
      <span className="px-2 text-xs text-muted-foreground">
        <Languages className="mr-1 inline h-3.5 w-3.5" />
        {label}
      </span>
      <Button variant={value === "zh" ? "default" : "ghost"} size="sm" onClick={() => onChange("zh")}>
        中文
      </Button>
      <Button variant={value === "en" ? "default" : "ghost"} size="sm" onClick={() => onChange("en")}>
        EN
      </Button>
    </div>
  )
}
