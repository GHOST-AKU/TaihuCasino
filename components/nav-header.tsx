"use client"

import Link from "next/link"
import { useState } from "react"
import { Bell, Languages, LogOut, Menu, Search, Settings, Sparkles, X } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import type { Language } from "@/lib/home-content"
import { cn } from "@/lib/utils"

interface NavItem {
  label: string
  href: string
  active?: boolean
}

interface NavHeaderProps {
  navItems: NavItem[]
  language: Language
  onLanguageChange: (language: Language) => void
  playerName: string
  profileLabel: string
  brand: string
  isAuthenticated: boolean
  authActionLabel: string
  authActionHref: string
  onLogout: () => void
  labels: {
    search: string
    notifications: string
    settings: string
    menu: string
    language: string
    theme: string
    light: string
    dark: string
  }
}

export function NavHeader({
  navItems,
  language,
  onLanguageChange,
  playerName,
  profileLabel,
  brand,
  isAuthenticated,
  authActionLabel,
  authActionHref,
  onLogout,
  labels,
}: NavHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notifications] = useState(3)

  const avatarFallback = playerName
    .split(" ")
    .map((item) => item[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

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
          <div className="hidden items-center rounded-full border border-border/50 bg-card/60 p-1 md:flex">
            <span className="px-2 text-xs text-muted-foreground">
              <Languages className="mr-1 inline h-3.5 w-3.5" />
              {labels.language}
            </span>
            <Button variant={language === "zh" ? "default" : "ghost"} size="sm" onClick={() => onLanguageChange("zh")}>
              中文
            </Button>
            <Button variant={language === "en" ? "default" : "ghost"} size="sm" onClick={() => onLanguageChange("en")}>
              EN
            </Button>
          </div>

          <ThemeToggle
            className="hidden lg:inline-flex"
            label={labels.theme}
            lightLabel={labels.light}
            darkLabel={labels.dark}
          />

          <Button variant="ghost" size="icon" className="hidden text-muted-foreground hover:text-foreground sm:flex">
            <Search className="h-5 w-5" />
            <span className="sr-only">{labels.search}</span>
          </Button>

          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
            <Bell className="h-5 w-5" />
            {notifications > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {notifications}
              </span>
            )}
            <span className="sr-only">{labels.notifications}</span>
          </Button>

          <Button variant="ghost" size="icon" className="hidden text-muted-foreground hover:text-foreground sm:flex">
            <Settings className="h-5 w-5" />
            <span className="sr-only">{labels.settings}</span>
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
                退出
              </Button>
            ) : (
              <Button asChild size="sm" className="hidden lg:inline-flex">
                <Link href={authActionHref}>{authActionLabel}</Link>
              </Button>
            )}

            <div className="hidden text-right lg:block">
              <p className="text-sm font-medium text-foreground">{playerName}</p>
              <p className="text-xs text-primary">{profileLabel}</p>
            </div>
            <Avatar className="h-9 w-9 border-2 border-primary/30">
              <AvatarImage
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
                alt={playerName}
              />
              <AvatarFallback className="bg-primary/20 text-primary">{avatarFallback}</AvatarFallback>
            </Avatar>
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
            <Button variant={language === "zh" ? "default" : "outline"} size="sm" onClick={() => onLanguageChange("zh")}>
              中文
            </Button>
            <Button variant={language === "en" ? "default" : "outline"} size="sm" onClick={() => onLanguageChange("en")}>
              EN
            </Button>
            {isAuthenticated ? (
              <Button variant="outline" size="sm" onClick={onLogout}>
                退出
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link href={authActionHref}>{authActionLabel}</Link>
              </Button>
            )}
          </div>

          <ThemeToggle
            className="mb-4 flex w-full justify-between"
            label={labels.theme}
            lightLabel={labels.light}
            darkLabel={labels.dark}
          />

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
