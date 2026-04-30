"use client"

import Link from "next/link"
import { Diamond, Dice1, ShieldCheck, Spade, Target, Trophy } from "lucide-react"

import { GameCard } from "@/components/game-card"
import { LivePlayers } from "@/components/live-players"
import { NavHeader } from "@/components/nav-header"
import { PlayerStats } from "@/components/player-stats"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/hooks/use-language"
import {
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
import { clearMemberSession } from "@/lib/member-session"
import { playableTableEntries } from "@/lib/game-catalog"

const gameIcons = {
  baccarat: <Diamond className="h-7 w-7" />,
  blackjack: <Spade className="h-7 w-7" />,
  roulette: <Target className="h-7 w-7" />,
  dice: <Dice1 className="h-7 w-7" />,
}

interface PlayerHomePageProps {
  initialLanguage: "zh" | "en"
  initialMemberName: string
}

export function PlayerHomePage({ initialLanguage, initialMemberName }: PlayerHomePageProps) {
  const [language] = useLanguage(initialLanguage)
  const isAuthenticated = true
  const authHref = "/login"

  async function handleLogout() {
    await clearMemberSession()
    window.location.assign("/login")
  }

  const viewerMode: ViewerMode = "member"
  const copy = getHomeCopy(language, viewerMode)
  const navItems = getNavItems(language)
  const games = getGameLinks(language)
  const stats = getStats(language, viewerMode)
  const quickActions = getQuickActions(language, viewerMode)
  const livePlayers = getLivePlayers(language)
  const recentActivities = getRecentActivities(language, viewerMode)
  const extraTables = playableTableEntries.filter(
    (table) => table.kind === "game" && !games.some((game) => game.slug === table.slug),
  )
  const displayName = initialMemberName || copy.playerName
  const lobbyQuickActions = quickActions
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
          playerName={displayName}
          brand={copy.brand}
          isAuthenticated={isAuthenticated}
          authActionLabel={language === "zh" ? "会员登录" : "Sign in"}
          authActionHref={authHref}
          onLogout={handleLogout}
          labels={copy.labels}
        />

        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
          <section className="lobby-hero-surface mb-6 rounded-2xl border border-border/50 p-5 md:p-6">
            <div className="grid items-center gap-5 lg:grid-cols-[1.35fr_0.65fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  {copy.hero.eyebrow}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  {copy.hero.title}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {copy.hero.description}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
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

              <div className="grid gap-2.5">
                {lobbyQuickActions.slice(0, 3).map((action, index) => {
                  const icons = [ShieldCheck, Trophy, Dice1]
                  const Icon = icons[index] ?? ShieldCheck

                  return (
                    <Link
                      key={action.key}
                      href={action.href}
                      className="group flex min-h-16 items-center gap-3 rounded-xl border border-border/60 bg-secondary/35 px-4 py-3 transition-colors hover:border-primary/25 hover:bg-secondary/55"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary group-hover:bg-primary/15">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{action.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{action.description}</p>
                      </div>
                    </Link>
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

              <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    href={game.href}
                    badgeLabel={game.badge[language]}
                    ctaLabel={copy.labels.cardCta}
                  />
                ))}
              </div>
            </section>

            <aside className="space-y-6">
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

          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {language === "zh" ? "更多桌台" : "More Tables"}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">
                  {language === "zh" ? "贵宾与快速玩法" : "VIP And Fast Tables"}
                </h2>
              </div>
              <Link href="/member" className="text-sm text-primary hover:underline">
                {language === "zh" ? "会员中心" : "Member center"}
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {extraTables.map((table) => (
                <Link
                  key={table.slug}
                  href={table.targetRoute}
                  className="lobby-panel-surface rounded-xl border border-border/50 p-4 transition-colors hover:border-primary/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{language === "zh" ? table.titleZh : table.title}</p>
                    <span className="rounded-full bg-primary/15 px-2 py-1 text-[11px] font-medium text-primary">
                      {language === "zh" ? "可玩" : "Open"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {language === "zh" ? table.descriptionZh : table.description}
                  </p>
                </Link>
              ))}
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
