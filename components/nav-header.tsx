"use client"

import Link from "next/link"
import { useState } from "react"
import { Bell, LogOut, Menu, Search, Settings, Sparkles, X } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface NavItem {
  label: string
  href: string
  active?: boolean
}

interface NavHeaderProps {
  navItems: NavItem[]
  playerName: string
  brand: string
  isAuthenticated: boolean
  authActionLabel: string
  authActionHref: string
  profileHref?: string
  settingsHref?: string
  onLogout: () => void
  labels: {
    search: string
    notifications: string
    settings: string
    menu: string
  }
}

export function NavHeader({
  navItems,
  playerName,
  brand,
  isAuthenticated,
  authActionLabel,
  authActionHref,
  profileHref = "/member",
  settingsHref = "/member/settings",
  onLogout,
  labels,
}: NavHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notifications] = useState(3)

  const avatarFallback =
    playerName
      .split(" ")
      .map((item) => item[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "TC"

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            {brand.slice(0, -6)}
            <span className="text-primary">{brand.slice(-6)}</span>
          </span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                item.active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="hidden text-muted-foreground hover:text-foreground sm:flex">
            <Search className="h-5 w-5" />
            <span className="sr-only">{labels.search}</span>
          </Button>

          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
            <Bell className="h-5 w-5" />
            {notifications > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {notifications}
              </span>
            ) : null}
            <span className="sr-only">{labels.notifications}</span>
          </Button>

          <Button asChild variant="ghost" size="icon" className="hidden text-muted-foreground hover:text-foreground sm:flex">
            <Link href={settingsHref} aria-label={labels.settings}>
              <Settings className="h-5 w-5" />
              <span className="sr-only">{labels.settings}</span>
            </Link>
          </Button>

          <div className="ml-2 flex items-center gap-2 border-l border-border/50 pl-2">
            {isAuthenticated ? (
              <Button
                variant="ghost"
                size="sm"
                className="hidden text-muted-foreground hover:text-foreground lg:inline-flex"
                onClick={onLogout}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            ) : (
              <Button asChild size="sm" className="hidden lg:inline-flex">
                <Link href={authActionHref}>{authActionLabel}</Link>
              </Button>
            )}

            <Link href={isAuthenticated ? profileHref : authActionHref} className="hidden text-right lg:block">
              <p className="text-sm font-medium text-foreground">{playerName}</p>
            </Link>
            <Link href={isAuthenticated ? profileHref : authActionHref} aria-label={playerName}>
              <Avatar className="h-9 w-9 border-2 border-primary/30">
                <AvatarImage
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
                  alt={playerName}
                />
                <AvatarFallback className="bg-primary/20 text-primary">{avatarFallback}</AvatarFallback>
              </Avatar>
            </Link>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground md:hidden"
            onClick={() => setMobileMenuOpen((current) => !current)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="sr-only">{labels.menu}</span>
          </Button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="border-t border-border/50 bg-background px-4 py-4 md:hidden">
          <div className="mb-4 flex flex-wrap gap-2">
            {isAuthenticated ? (
              <Button variant="outline" size="sm" onClick={onLogout}>
                Sign out
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link href={authActionHref}>{authActionLabel}</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={settingsHref}>{labels.settings}</Link>
            </Button>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={cn(
                  "rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  item.active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  )
}
