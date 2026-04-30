"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import { NavHeader } from "@/components/nav-header"
import { useLanguage } from "@/hooks/use-language"
import { getHomeCopy, type Language } from "@/lib/home-content"
import { clearMemberSession } from "@/lib/member-session"

export function MemberGameFrame({
  initialLanguage,
  memberName,
  children,
}: {
  initialLanguage: Language
  memberName: string
  children: ReactNode
}) {
  const [language] = useLanguage(initialLanguage)
  const copy = getHomeCopy(language, "member")
  const navItems =
    language === "zh"
      ? [
          { label: "游戏大厅", href: `/?lang=${language}` },
          { label: "会员中心", href: "/member" },
          { label: "最近记录", href: `/?lang=${language}#history` },
        ]
      : [
          { label: "Lobby", href: `/?lang=${language}` },
          { label: "Member", href: "/member" },
          { label: "History", href: `/?lang=${language}#history` },
        ]

  async function handleLogout() {
    await clearMemberSession()
    window.location.assign("/login")
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <NavHeader
        navItems={navItems}
        playerName={memberName}
        brand={copy.brand}
        isAuthenticated
        authActionLabel={language === "zh" ? "会员登录" : "Sign in"}
        authActionHref="/login"
        onLogout={handleLogout}
        labels={copy.labels}
      />

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border/50 bg-card/30">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 lg:flex-row lg:px-8">
          <span className="text-sm text-muted-foreground">{copy.labels.footerTagline}</span>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href={`/?lang=${language}`} className="transition-colors hover:text-foreground">
              {copy.labels.gamesHeading}
            </Link>
            <Link href="/member" className="transition-colors hover:text-foreground">
              {language === "zh" ? "会员中心" : "Member Center"}
            </Link>
            <Link href="/member/settings" className="transition-colors hover:text-foreground">
              {copy.labels.settings}
            </Link>
            <Link href={`/?lang=${language}#history`} className="transition-colors hover:text-foreground">
              {copy.labels.history}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
