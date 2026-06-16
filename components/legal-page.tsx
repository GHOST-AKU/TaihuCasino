import Link from "next/link"
import type { ReactNode } from "react"

import { LEGAL_DRAFT_STATUS } from "@/lib/legal"

export function LegalPage({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string
  title: string
  summary: string
  children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          Back to TaihuCasino / 返回太湖赌场
        </Link>
        <header className="mt-8 rounded-3xl border border-border/60 bg-card/70 p-7 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground">{summary}</p>
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-900 dark:text-amber-100">
            {LEGAL_DRAFT_STATUS}. This page is a product and engineering framework, not approved legal advice.
            <br />
            工程草稿，等待产品与法律审查。本页面用于搭建产品框架，不代表已经获得法律批准。
          </div>
        </header>
        <article className="mt-8 space-y-8 rounded-3xl border border-border/60 bg-card/50 p-7 leading-8 sm:p-10">
          {children}
        </article>
        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground">Terms / 条款</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy / 隐私</Link>
          <Link href="/responsible-gaming" className="hover:text-foreground">Responsible Gaming / 理性游戏</Link>
          <Link href="/support" className="hover:text-foreground">Support / 支持</Link>
        </nav>
      </div>
    </main>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-muted-foreground sm:text-base">{children}</div>
    </section>
  )
}
