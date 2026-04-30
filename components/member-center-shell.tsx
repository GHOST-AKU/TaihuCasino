import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft, Settings, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ThemeHeroSurface, ThemePageShell } from "@/components/theme-page-shell"
import { cn } from "@/lib/utils"

interface MemberCenterShellProps {
  title: string
  subtitle: string
  active: "profile" | "settings"
  children: ReactNode
  labels?: {
    backToLobby: string
    eyebrow: string
    profile: string
    settings: string
  }
}

export function MemberCenterShell({ title, subtitle, active, children, labels }: MemberCenterShellProps) {
  const copy = labels ?? {
    backToLobby: "Back to lobby",
    eyebrow: "TaihuCasino Member Center",
    profile: "Member info",
    settings: "Settings",
  }
  const navItems = [
    {
      key: "profile",
      href: "/member",
      label: copy.profile,
      icon: UserRound,
    },
    {
      key: "settings",
      href: "/member/settings",
      label: copy.settings,
      icon: Settings,
    },
  ] as const

  return (
    <ThemePageShell>
      <ThemeHeroSurface className="mb-6 p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Button asChild variant="outline" size="sm" className="mb-4">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                {copy.backToLobby}
              </Link>
            </Button>
            <p className="text-xs uppercase tracking-[0.18em] text-primary">{copy.eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{subtitle}</p>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <nav className="flex flex-wrap gap-2 rounded-2xl border border-border/50 bg-background/60 p-2">
              {navItems.map((item) => {
                const Icon = item.icon

                return (
                  <Button
                    key={item.key}
                    asChild
                    variant={active === item.key ? "default" : "ghost"}
                    size="sm"
                    className={cn(active !== item.key && "text-muted-foreground")}
                  >
                    <Link href={item.href}>
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </Button>
                )
              })}
            </nav>
          </div>
        </div>
      </ThemeHeroSurface>

      {children}
    </ThemePageShell>
  )
}
