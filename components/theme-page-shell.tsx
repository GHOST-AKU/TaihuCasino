import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface ThemePageShellProps {
  children: ReactNode
  className?: string
  containerClassName?: string
}

export function ThemePageShell({
  children,
  className,
  containerClassName,
}: ThemePageShellProps) {
  return (
    <main className={cn("theme-shell relative min-h-screen overflow-hidden bg-background", className)}>
      <div className="pointer-events-none absolute inset-0">
        <div className="theme-ambient-orb absolute -left-16 top-24 h-72 w-72 rounded-full blur-3xl" />
        <div className="theme-ambient-orb theme-ambient-orb-secondary absolute right-0 top-0 h-96 w-96 rounded-full blur-3xl" />
        <div className="theme-grid-mask absolute inset-0 opacity-60" />
      </div>

      <div className={cn("relative z-10 mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8", containerClassName)}>
        {children}
      </div>
    </main>
  )
}

interface ThemeSurfaceProps {
  children: ReactNode
  className?: string
}

export function ThemeHeroSurface({ children, className }: ThemeSurfaceProps) {
  return (
    <section className={cn("theme-hero-surface rounded-3xl border border-border/50", className)}>
      {children}
    </section>
  )
}

export function ThemePanelSurface({ children, className }: ThemeSurfaceProps) {
  return (
    <section className={cn("theme-panel-surface rounded-2xl border border-border/50", className)}>
      {children}
    </section>
  )
}
