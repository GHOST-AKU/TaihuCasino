"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Diamond, Dice1, ShieldCheck, Spade, Target, Trophy } from "lucide-react"

import { GameCard } from "@/components/game-card"
import { LivePlayers } from "@/components/live-players"
import { NavHeader } from "@/components/nav-header"
import { PlayerStats } from "@/components/player-stats"
import { QuickActions } from "@/components/quick-actions"
import { Button } from "@/components/ui/button"
import {
  LANGUAGE_STORAGE_KEY,
  type Language,
  type ViewerMode,
  getCoreGame,
  getGameLinks,
  getHomeCopy,
  getLivePlayers,
  getNavItems,
  getQuickActions,
  getRecentActivities,
  getStats,
} from "@/lib/home-content"
import { clearMemberSession, readMemberSession } from "@/lib/member-session"

const gameIcons = {
  baccarat: <Diamond className="h-7 w-7" />,
  blackjack: <Spade className="h-7 w-7" />,
  roulette: <Target className="h-7 w-7" />,
  dice: <Dice1 className="h-7 w-7" />,
}

export default function PlayerHomePage() {
  const [language, setLanguage] = useState<Language>("zh")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [memberName, setMemberName] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const queryLanguage = params.get("lang")
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    const session = readMemberSession()

    const nextLanguage =
      queryLanguage === "zh" || queryLanguage === "en"
        ? queryLanguage
        : savedLanguage === "zh" || savedLanguage === "en"
          ? savedLanguage
          : "zh"

    setLanguage(nextLanguage)
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
    setIsAuthenticated(Boolean(session))
    setMemberName(session?.displayName ?? "")
  }, [])

  function handleLanguageChange(nextLanguage: Language) {
    setLanguage(nextLanguage)
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
    const url = new URL(window.location.href)
    url.searchParams.set("lang", nextLanguage)
    window.history.replaceState({}, "", url)
  }

  function handleLogout() {
    clearMemberSession()
    setIsAuthenticated(false)
    setMemberName("")
  }

  const viewerMode: ViewerMode = isAuthenticated ? "member" : "guest"
  const copy = getHomeCopy(language, viewerMode)
  const navItems = getNavItems(language)
  const games = getGameLinks(language)
  const stats = getStats(language, viewerMode)
  const quickActions = getQuickActions(language, viewerMode)
  const livePlayers = getLivePlayers(language)
  const recentActivities = getRecentActivities(language, viewerMode)
  const authHref = `/login?next=${encodeURIComponent(`/?lang=${language}`)}`
  const displayName = isAuthenticated && memberName ? memberName : copy.playerName
  const profileLabel = isAuthenticated
    ? language === "zh"
      ? "已登录会员"
      : "Signed in member"
    : copy.profileLabel
  const lobbyQuickActions = !isAuthenticated && quickActions.length > 0
    ? quickActions.map((item, index) =>
        index === 0
          ? {
              ...item,
              href: authHref,
              label: language === "zh" ? "先登录再开始" : "Sign in first",
              description:
                language === "zh"
                  ? "进入会员中心后继续大厅与牌桌流程"
                  : "Enter the member flow before opening tables",
            }
          : item,
      )
    : quickActions

  return (
    <div className="lobby-shell relative min-h-screen overflow-hidden bg-background" id="top">
      <div className="pointer-events-none absolute inset-0">
        <div className="lobby-ambient-orb absolute -left-16 top-24 h-72 w-72 rounded-full blur-3xl" />
        <div className="lobby-ambient-orb lobby-ambient-orb-secondary absolute right-0 top-0 h-96 w-96 rounded-full blur-3xl" />
        <div className="lobby-grid-mask absolute inset-0 opacity-60" />
      </div>

      <div className="relative z-10">
        <NavHeader
          navItems={navItems}
          language={language}
          onLanguageChange={handleLanguageChange}
          playerName={displayName}
          profileLabel={profileLabel}
          brand={copy.brand}
          isAuthenticated={isAuthenticated}
          authActionLabel={language === "zh" ? "会员登录" : "Sign in"}
          authActionHref={authHref}
          onLogout={handleLogout}
          labels={{
            ...copy.labels,
            theme: language === "zh" ? "主题" : "Theme",
            light: language === "zh" ? "浅色" : "Light",
            dark: language === "zh" ? "深色" : "Dark",
          }}
        />

        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
          <section className="lobby-hero-surface mb-8 rounded-3xl border border-border/50 p-6 md:p-8">
            <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  {copy.hero.eyebrow}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                  {copy.hero.title}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                  {copy.hero.description}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild size="lg">
                    <Link href={copy.hero.primaryHref}>{copy.hero.primaryCta}</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href={copy.hero.secondaryHref}>{copy.hero.secondaryCta}</Link>
                  </Button>
                  {!isAuthenticated ? (
                    <Button asChild variant="secondary" size="lg">
                      <Link href={authHref}>{language === "zh" ? "登录进入会员中心" : "Sign in to continue"}</Link>
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3">
                {copy.hero.highlights.map((highlight, index) => {
                  const icons = [ShieldCheck, Trophy, Dice1]
                  const Icon = icons[index] ?? ShieldCheck

                  return (
                    <div
                      key={highlight.label}
                      className="lobby-panel-surface rounded-2xl border border-border/50 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-primary/15 p-2 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {highlight.label}
                          </p>
                          <p className="mt-2 text-base font-semibold text-foreground">
                            {highlight.value}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="mb-8">
            <PlayerStats items={stats} />
          </section>

          <div className="grid gap-6 lg:grid-cols-4">
            <section className="lg:col-span-3" id="games">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {copy.labels.gamesSubheading}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">
                    {copy.labels.gamesHeading}
                  </h2>
                </div>
                <a href="#history" className="text-sm text-primary hover:underline">
                  {copy.labels.gamesViewAll}
                </a>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {games.map((game) => (
                  <GameCard
                    key={game.slug}
                    title={game.title}
                    subtitle={game.subtitle[language]}
                    icon={gameIcons[game.slug]}
                    players={game.players}
                    rating={game.rating}
                    trend={game.trend}
                    featured={game.featured}
                    className={game.featured ? "sm:col-span-2 lg:col-span-2 lg:row-span-2" : ""}
                    href={game.href}
                    badgeLabel={game.badge[language]}
                    ctaLabel={copy.labels.cardCta}
                  />
                ))}
              </div>
            </section>

            <aside className="space-y-6">
              <div id="quick-actions">
                <QuickActions title={copy.labels.quickActions} items={lobbyQuickActions} />
              </div>
              <div id="leaderboard">
                <LivePlayers
                  title={copy.labels.liveWins}
                  liveLabel={copy.labels.liveBadge}
                  players={livePlayers}
                />
              </div>
            </aside>
          </div>

          <section className="mt-8" id="history">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{copy.labels.history}</h2>
              <a href="#top" className="text-sm text-primary hover:underline">
                {copy.labels.historyViewAll}
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recentActivities.map((activity) => {
                const matchedGame = games.find((game) => game.title === activity.game)
                const fallbackGame = matchedGame ?? getCoreGame("baccarat")!

                return (
                  <Link
                    key={`${activity.game}-${activity.time}`}
                    href={matchedGame ? matchedGame.href : `/games/${fallbackGame.slug}?lang=${language}`}
                    className="lobby-panel-surface rounded-xl border border-border/50 p-4 transition-colors hover:border-primary/20"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{activity.game}</p>
                      <span className={`text-xs font-medium ${activity.positive ? "text-primary" : "text-destructive"}`}>
                        {activity.result}
                      </span>
                    </div>
                    <p className={`mt-1 text-lg font-semibold ${activity.positive ? "text-primary" : "text-destructive"}`}>
                      {activity.amount}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{activity.time}</p>
                  </Link>
                )
              })}
            </div>
          </section>
        </main>

        <footer className="mt-12 border-t border-border/50 bg-card/30">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 lg:flex-row lg:px-8">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{copy.labels.footerTagline}</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#top" className="transition-colors hover:text-foreground">{copy.labels.terms}</a>
              <a href="#top" className="transition-colors hover:text-foreground">{copy.labels.privacy}</a>
              <a href="#top" className="transition-colors hover:text-foreground">{copy.labels.support}</a>
              <a href="#top" className="transition-colors hover:text-foreground">{copy.labels.responsibleGaming}</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
