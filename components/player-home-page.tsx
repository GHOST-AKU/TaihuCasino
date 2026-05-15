"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Diamond, Dice1, ShieldCheck, Spade, Target, Trophy } from "lucide-react"

import { GameCard } from "@/components/game-card"
import { LivePlayers } from "@/components/live-players"
import { NavHeader } from "@/components/nav-header"
import { PlayerStats } from "@/components/player-stats"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/hooks/use-language"
import {
  type HomeActivityItem,
  type HomeStatItem,
  type ViewerMode,
  getCoreGame,
  getGameLinks,
  getHomeCopy,
  getNavItems,
  getQuickActions,
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
  initialMemberOverview: {
    wallet: {
      balance: number
    }
    progress: Array<{
      plays: number
      wins: number
      losses: number
      streak: number
      bestStreak: number
    }>
    walletLedger: Array<{
      id: string
      amount: number
      source: string
      createdAt: string
      metadata: Record<string, unknown>
    }>
    gameRounds: Array<{
      id: string
      gameSlug: string
      outcome: "win" | "loss" | "push"
      delta: number
      createdAt: string
    }>
  }
}

type RecentActivity = HomeActivityItem & {
  id: string
  gameSlug?: string
}

type HomeMemberOverview = PlayerHomePageProps["initialMemberOverview"]

function formatMoney(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  })
}

function isToday(value: string) {
  const date = new Date(value)
  const today = new Date()

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

function buildTodayNet(member: PlayerHomePageProps["initialMemberOverview"]) {
  const gamingLedgerSources = new Set(["game_round", "table_buy_in", "table_cash_out"])
  const todayGamingLedger = member.walletLedger.filter(
    (entry) => gamingLedgerSources.has(entry.source) && isToday(entry.createdAt),
  )

  if (todayGamingLedger.length > 0) {
    return todayGamingLedger.reduce((sum, entry) => sum + entry.amount, 0)
  }

  return member.gameRounds
    .filter((round) => isToday(round.createdAt))
    .reduce((sum, round) => sum + round.delta, 0)
}

function buildMemberStats(
  language: "zh" | "en",
  member: PlayerHomePageProps["initialMemberOverview"],
): HomeStatItem[] {
  const sortedRounds = [...member.gameRounds].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )
  const chronologicalRounds = [...sortedRounds].reverse()
  const plays = sortedRounds.length || member.progress.reduce((sum, progress) => sum + progress.plays, 0)
  const wins = sortedRounds.length
    ? sortedRounds.filter((round) => round.outcome === "win" || round.delta > 0).length
    : member.progress.reduce((sum, progress) => sum + progress.wins, 0)
  const currentStreak = sortedRounds.length
    ? sortedRounds.findIndex((round) => !(round.outcome === "win" || round.delta > 0))
    : Math.max(0, ...member.progress.map((progress) => progress.streak))
  let bestStreakFromRounds = 0
  let runningStreak = 0

  for (const round of chronologicalRounds) {
    if (round.outcome === "win" || round.delta > 0) {
      runningStreak += 1
      bestStreakFromRounds = Math.max(bestStreakFromRounds, runningStreak)
    } else if (round.outcome === "loss" || round.delta < 0) {
      runningStreak = 0
    }
  }

  const bestStreak = sortedRounds.length
    ? bestStreakFromRounds
    : Math.max(0, ...member.progress.map((progress) => progress.bestStreak))
  const trackedTables = new Set([
    ...member.progress.map((progress) => "gameSlug" in progress ? String(progress.gameSlug) : ""),
    ...member.gameRounds.map((round) => round.gameSlug),
  ].filter(Boolean)).size
  const winRate = plays > 0 ? Math.round((wins / plays) * 100) : 0
  const todayNet = buildTodayNet(member)
  const normalizedCurrentStreak = currentStreak < 0 ? sortedRounds.length : currentStreak

  if (language === "zh") {
    return [
      {
        key: "balance",
        label: "账户余额",
        value: formatMoney(member.wallet.balance),
        subtext: `今日净赢 ${todayNet >= 0 ? "+" : ""}${formatMoney(todayNet)}`,
        trend: todayNet > 0 ? "up" : todayNet < 0 ? "down" : "neutral",
      },
      {
        key: "rate",
        label: "胜率",
        value: `${winRate}%`,
        subtext: plays > 0 ? `${wins}/${plays} 局获胜` : "还没有完成牌局",
        trend: winRate >= 50 ? "up" : winRate > 0 ? "neutral" : "neutral",
      },
      {
        key: "recent",
        label: "最近游玩",
        value: `${plays} 局`,
        subtext: trackedTables > 0 ? `${trackedTables} 个桌台有记录` : "开始第一局后自动更新",
        trend: "neutral",
      },
      {
        key: "streak",
        label: "连胜记录",
        value: `${normalizedCurrentStreak} 局`,
        subtext: bestStreak > normalizedCurrentStreak ? `个人最好 ${bestStreak} 局` : "当前为个人最好",
        trend: normalizedCurrentStreak > 0 ? "up" : "neutral",
      },
    ]
  }

  return [
    {
      key: "balance",
      label: "Balance",
      value: formatMoney(member.wallet.balance),
      subtext: `Today ${todayNet >= 0 ? "+" : ""}${formatMoney(todayNet)}`,
      trend: todayNet > 0 ? "up" : todayNet < 0 ? "down" : "neutral",
    },
    {
      key: "rate",
      label: "Win Rate",
      value: `${winRate}%`,
      subtext: plays > 0 ? `${wins}/${plays} rounds won` : "No settled rounds yet",
      trend: winRate >= 50 ? "up" : winRate > 0 ? "neutral" : "neutral",
    },
    {
      key: "recent",
      label: "Recent Play",
      value: `${plays}`,
      subtext: trackedTables > 0 ? `${trackedTables} tables tracked` : "Updates after your first round",
      trend: "neutral",
    },
    {
      key: "streak",
      label: "Streak",
      value: `${normalizedCurrentStreak}`,
      subtext: bestStreak > normalizedCurrentStreak ? `Best streak ${bestStreak}` : "Current personal best",
      trend: normalizedCurrentStreak > 0 ? "up" : "neutral",
    },
  ]
}

function formatSignedMoney(value: number) {
  if (value === 0) {
    return "$0"
  }

  return `${value > 0 ? "+" : "-"}${formatMoney(Math.abs(value))}`
}

function formatRelativeTime(value: string, language: "zh" | "en") {
  const timestamp = new Date(value).getTime()

  if (!Number.isFinite(timestamp)) {
    return language === "zh" ? "刚刚" : "Just now"
  }

  const elapsedMs = Date.now() - timestamp
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000))

  if (elapsedMinutes < 1) {
    return language === "zh" ? "刚刚" : "Just now"
  }

  if (elapsedMinutes < 60) {
    return language === "zh" ? `${elapsedMinutes} 分钟前` : `${elapsedMinutes} min ago`
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60)

  if (elapsedHours < 24) {
    return language === "zh" ? `${elapsedHours} 小时前` : `${elapsedHours} hr ago`
  }

  const elapsedDays = Math.floor(elapsedHours / 24)
  return language === "zh" ? `${elapsedDays} 天前` : `${elapsedDays} days ago`
}

function titleForGameSlug(slug: string | undefined, language: "zh" | "en") {
  const game = slug ? getCoreGame(slug) : null

  if (!game) {
    return language === "zh" ? "会员牌局" : "Member Round"
  }

  return language === "zh" ? game.titleZh : game.title
}

function resultForLedgerEntry(entry: PlayerHomePageProps["initialMemberOverview"]["walletLedger"][number], language: "zh" | "en") {
  const outcome = typeof entry.metadata.outcome === "string" ? entry.metadata.outcome : null

  if (outcome === "win" || (!outcome && entry.amount > 0)) {
    return language === "zh" ? "赢" : "Won"
  }

  if (outcome === "loss" || (!outcome && entry.amount < 0)) {
    return language === "zh" ? "负" : "Lost"
  }

  return language === "zh" ? "和" : "Push"
}

function resultForGameRound(round: PlayerHomePageProps["initialMemberOverview"]["gameRounds"][number], language: "zh" | "en") {
  if (round.outcome === "win" || (round.outcome === "push" && round.delta > 0)) {
    return language === "zh" ? "赢" : "Won"
  }

  if (round.outcome === "loss" || (round.outcome === "push" && round.delta < 0)) {
    return language === "zh" ? "负" : "Lost"
  }

  return language === "zh" ? "和" : "Push"
}

function buildRecentActivities(
  language: "zh" | "en",
  member: PlayerHomePageProps["initialMemberOverview"],
): RecentActivity[] {
  return member.gameRounds
    .slice(0, 4)
    .map((round) => ({
      id: round.id,
      game: titleForGameSlug(round.gameSlug, language),
      gameSlug: round.gameSlug,
      result: resultForGameRound(round, language),
      amount: formatSignedMoney(round.delta),
      time: formatRelativeTime(round.createdAt, language),
      positive: round.delta >= 0,
    }))
}

function isWithinLastWeek(value: string) {
  const timestamp = new Date(value).getTime()

  if (!Number.isFinite(timestamp)) {
    return false
  }

  return Date.now() - timestamp <= 7 * 24 * 60 * 60 * 1000
}

function buildWeeklyProfitBoard(
  language: "zh" | "en",
  member: PlayerHomePageProps["initialMemberOverview"],
) {
  const grouped = new Map<string, { gameSlug?: string; amount: number; rounds: number }>()

  for (const round of member.gameRounds) {
    if (!isWithinLastWeek(round.createdAt)) {
      continue
    }

    const gameSlug = round.gameSlug
    const key = gameSlug || "unknown"
    const current = grouped.get(key) ?? { gameSlug, amount: 0, rounds: 0 }

    grouped.set(key, {
      gameSlug,
      amount: current.amount + round.delta,
      rounds: current.rounds + 1,
    })
  }

  return Array.from(grouped.values())
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5)
    .map((item) => ({
      name: titleForGameSlug(item.gameSlug, language),
      game:
        language === "zh"
          ? `${item.rounds} 局 · 最近 7 天`
          : `${item.rounds} rounds · Last 7 days`,
      amount: formatSignedMoney(item.amount),
    }))
}

export function PlayerHomePage({ initialLanguage, initialMemberName, initialMemberOverview }: PlayerHomePageProps) {
  const [language] = useLanguage(initialLanguage)
  const [memberOverview, setMemberOverview] = useState<HomeMemberOverview>(initialMemberOverview)
  const isAuthenticated = true
  const authHref = "/login"

  useEffect(() => {
    let active = true

    async function refreshMemberOverview() {
      const response = await fetch("/api/member/me", {
        cache: "no-store",
      }).catch(() => null)

      if (!response?.ok) {
        return
      }

      const payload = (await response.json().catch(() => null)) as { member?: HomeMemberOverview } | null

      if (active && payload?.member) {
        setMemberOverview(payload.member)
      }
    }

    void refreshMemberOverview()

    function handlePageShow() {
      void refreshMemberOverview()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshMemberOverview()
      }
    }

    window.addEventListener("pageshow", handlePageShow)
    window.addEventListener("focus", handlePageShow)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      active = false
      window.removeEventListener("pageshow", handlePageShow)
      window.removeEventListener("focus", handlePageShow)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  async function handleLogout() {
    await clearMemberSession()
    window.location.assign("/login")
  }

  const viewerMode: ViewerMode = "member"
  const copy = getHomeCopy(language, viewerMode)
  const navItems = getNavItems(language)
  const games = getGameLinks(language)
  const stats = buildMemberStats(language, memberOverview)
  const quickActions = getQuickActions(language, viewerMode)
  const weeklyProfitBoard = buildWeeklyProfitBoard(language, memberOverview)
  const recentActivities = buildRecentActivities(language, memberOverview)
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
                  emptyLabel={language === "zh" ? "本周还没有完成的牌局。" : "No settled rounds this week."}
                  players={weeklyProfitBoard}
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
              {recentActivities.length > 0 ? recentActivities.map((activity) => {
                const matchedGame = games.find((game) => game.slug === activity.gameSlug || game.title === activity.game)
                const fallbackGame = matchedGame ?? getCoreGame("baccarat")!

                return (
                  <Link
                    key={activity.id}
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
              }) : (
                <div className="lobby-panel-surface rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">
                  {language === "zh" ? "还没有真实牌局记录。进入任意桌台完成一局后，这里会显示最近结算。" : "No real rounds yet. Finish a table round and the latest settlement will appear here."}
                </div>
              )}
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
