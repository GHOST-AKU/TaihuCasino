"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowLeft, BookOpen, Landmark, LogOut, Play, RotateCcw, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/hooks/use-language"
import {
  isRegionalGameRuleId,
  REGIONAL_GAME_RULES,
  type GameRuleMetadata,
  type RegionalGameRuleId,
} from "@/lib/game-rules"
import type { CasinoTableEntry } from "@/lib/game-catalog"
import type { Language } from "@/lib/home-content"
import type { MemberGameProgress, MemberGameRound, MemberTableSession } from "@/lib/member-data"
import { recordClientGameRound } from "@/lib/member-round-client"
import { formatAmount } from "@/lib/number-format"
import { cashOutClientTableSession, openClientTableSession } from "@/lib/table-session-client"
import { cn } from "@/lib/utils"

const symbolGlyphs: Record<string, string> = {
  fish: "鱼",
  prawn: "虾",
  crab: "蟹",
  coin: "钱",
  gourd: "葫",
  rooster: "鸡",
  crown: "♛",
  anchor: "⚓",
  heart: "♥",
  diamond: "♦",
  club: "♣",
  spade: "♠",
}

function totalStake(bets: Record<string, number>) {
  return Object.values(bets).reduce((sum, amount) => sum + amount, 0)
}

function formatOdds(min: number, max: number) {
  return min === max ? `${min}:1` : `${min}–${max}:1`
}

function resultTokens(snapshot: Record<string, unknown>, isChinese: boolean) {
  if (Array.isArray(snapshot.symbols)) {
    return snapshot.symbols.filter((value): value is string => typeof value === "string")
  }
  if (typeof snapshot.remainder === "number") {
    const tokens = typeof snapshot.beadCount === "number"
      ? [isChinese ? `${snapshot.beadCount} 枚` : `${snapshot.beadCount} beads`]
      : []
    return [...tokens, isChinese ? `余 ${snapshot.remainder}` : `Remainder ${snapshot.remainder}`]
  }
  if (typeof snapshot.result === "number") return [String(snapshot.result)]
  return []
}

function roundBets(round: MemberGameRound) {
  const raw = round.betSnapshot.bets
  if (!Array.isArray(raw)) return []
  return raw.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return []
    const item = value as Record<string, unknown>
    return typeof item.key === "string" && typeof item.amount === "number"
      ? [{ key: item.key, amount: item.amount }]
      : []
  })
}

type RegionalGameTablePageProps = {
  entry: CasinoTableEntry
  defaultLanguage: Language
  initialWalletBalance: number
  initialProgress: MemberGameProgress | null
  initialTableSession: MemberTableSession | null
  initialGameRounds: MemberGameRound[]
}

export function RegionalGameTablePage(props: RegionalGameTablePageProps) {
  if (!isRegionalGameRuleId(props.entry.ruleSet)) {
    throw new Error(`Regional rules are unavailable for ${props.entry.slug}.`)
  }

  return <RegionalGameTableContent {...props} ruleSet={props.entry.ruleSet} />
}

function RegionalGameTableContent({
  entry,
  defaultLanguage,
  initialWalletBalance,
  initialProgress,
  initialTableSession,
  initialGameRounds,
  ruleSet,
}: RegionalGameTablePageProps & { ruleSet: RegionalGameRuleId }) {
  const [language] = useLanguage(defaultLanguage)
  const isChinese = language === "zh"
  const rules: GameRuleMetadata<RegionalGameRuleId> = REGIONAL_GAME_RULES[ruleSet]

  const [walletBalance, setWalletBalance] = useState(initialWalletBalance)
  const [tableSession, setTableSession] = useState(initialTableSession)
  const [bankroll, setBankroll] = useState(initialTableSession?.chipBalance ?? 0)
  const [buyInAmount, setBuyInAmount] = useState(Math.max(100, entry.defaultBet * 10))
  const [stake, setStake] = useState(entry.defaultBet)
  const [bets, setBets] = useState<Record<string, number>>({})
  const [rounds, setRounds] = useState(initialGameRounds)
  const [pendingRound, setPendingRound] = useState<{
    key: string
    bets: Record<string, number>
  } | null>(null)
  const [busy, setBusy] = useState<"buy-in" | "settle" | "cash-out" | null>(null)
  const [message, setMessage] = useState(
    isChinese ? "先买入桌台筹码，再选择一个或多个下注项。" : "Buy in, then choose one or more betting options.",
  )
  const [showRules, setShowRules] = useState(false)

  const activeStake = totalStake(bets)
  const expectedValue = useMemo(() => rules.betOptions.reduce((sum, option) => (
    sum + (bets[option.key] ?? 0) * option.expectedValue
  ), 0), [bets, rules.betOptions])
  const recentRounds = [...rounds]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 12)
  const latest = recentRounds[0]

  function addBet(key: string) {
    if (busy) return
    if (pendingRound) {
      setMessage(isChinese ? "上次结算结果尚未确认，请先重试同一回合。" : "Retry the pending settlement before changing its bets.")
      return
    }
    if (!tableSession) {
      setMessage(isChinese ? "请先从主钱包买入桌台筹码。" : "Buy in from the main wallet first.")
      return
    }
    if (activeStake + stake > bankroll) {
      setMessage(isChinese ? "桌台筹码不足，无法追加这笔下注。" : "Not enough table chips for this bet.")
      return
    }
    setBets((current) => ({ ...current, [key]: (current[key] ?? 0) + stake }))
  }

  async function buyIn() {
    if (busy || tableSession) return
    const amount = Math.max(1, Math.min(1_000_000, Math.round(buyInAmount * 100) / 100))
    if (amount > walletBalance) {
      setMessage(isChinese ? "主钱包余额不足。" : "The main wallet cannot cover this buy-in.")
      return
    }
    setBusy("buy-in")
    setMessage(isChinese ? "正在买入桌台筹码…" : "Buying table chips…")
    try {
      const result = await openClientTableSession(entry.slug, amount, "regional-buy-in")
      setTableSession(result.tableSession)
      setBankroll(result.tableSession.chipBalance)
      setWalletBalance(result.walletBalance ?? walletBalance - amount)
      setMessage(isChinese ? "桌台已准备好，可以下注。" : "The table is ready for bets.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "买入失败。" : "Buy-in failed.")
    } finally {
      setBusy(null)
    }
  }

  async function settleRound() {
    if (!tableSession || busy || activeStake <= 0) {
      setMessage(isChinese ? "请先买入并至少选择一项有效下注。" : "Buy in and place at least one valid bet.")
      return
    }
    const activeSession = tableSession
    const betsThisRound = pendingRound?.bets ?? { ...bets }
    const key = pendingRound?.key ?? `${entry.slug}-${crypto.randomUUID()}`
    if (!pendingRound) setPendingRound({ key, bets: betsThisRound })
    setBusy("settle")
    setMessage(isChinese ? "服务端正在生成并结算权威结果…" : "The server is generating and settling the authoritative result…")
    try {
      const result = await recordClientGameRound({
        gameSlug: entry.slug,
        idempotencyKey: key,
        tableSessionId: activeSession.id,
        betSnapshot: { bets: Object.entries(betsThisRound).map(([betKey, amount]) => ({ key: betKey, amount })) },
      })
      const round = result.round
      if (!round) throw new Error(isChinese ? "服务端未返回权威回合。" : "No authoritative round was returned.")

      const hydrated: MemberGameRound = {
        id: round.roundId,
        gameSlug: round.gameSlug,
        tableSessionId: round.tableSessionId,
        roundStatus: round.status,
        totalStake: round.totalStake,
        delta: round.delta,
        outcome: round.outcome,
        chipBalanceBefore: round.chipBalanceBefore,
        chipBalanceAfter: round.chipBalanceAfter,
        resultSummary: round.summary,
        betSnapshot: round.betSnapshot,
        resultSnapshot: round.resultSnapshot,
        idempotencyKey: key,
        createdAt: round.serverTimestamp,
      }
      setRounds((current) => [hydrated, ...current.filter((item) => item.id !== hydrated.id)])
      setBankroll(round.chipBalanceAfter)
      setTableSession({ ...activeSession, chipBalance: round.chipBalanceAfter })
      setBets({})
      setPendingRound(null)
      setMessage(round.summary)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "结算失败，可安全重试同一回合。" : "Settlement failed; the same round can be retried safely.")
    } finally {
      setBusy(null)
    }
  }

  async function cashOut() {
    if (!tableSession || busy) return
    if (pendingRound) {
      setMessage(isChinese ? "请先确认待重试回合的权威结果，再离桌。" : "Resolve the pending round before cashing out.")
      return
    }
    const activeSession = tableSession
    setBusy("cash-out")
    setMessage(isChinese ? "正在将桌台筹码结算回主钱包…" : "Cashing table chips back to the main wallet…")
    try {
      const result = await cashOutClientTableSession(activeSession.id, "regional-cash-out")
      setWalletBalance(result.walletBalance ?? walletBalance + activeSession.chipBalance)
      setTableSession(null)
      setBankroll(0)
      setBets({})
      setMessage(isChinese ? "已安全离桌，筹码回到主钱包。" : "Cash-out complete; chips returned to the main wallet.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "离桌失败。" : "Cash-out failed.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="theme-shell relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="theme-ambient-orb absolute -left-20 top-20 h-80 w-80 rounded-full blur-3xl" />
        <div className="theme-ambient-orb theme-ambient-orb-secondary absolute right-0 top-0 h-96 w-96 rounded-full blur-3xl" />
        <div className="theme-grid-mask absolute inset-0 opacity-50" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-7 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Button asChild variant="outline" size="sm" className="mb-5">
              <Link href={`/?lang=${language}`}><ArrowLeft />{isChinese ? "返回大厅" : "Back to lobby"}</Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{isChinese ? "单人 · 服务端权威结算" : "Solo · server authoritative"}</Badge>
              <Badge variant="outline">rules {rules.rulesVersion}</Badge>
            </div>
            <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
              {isChinese ? entry.titleZh : entry.title}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              {isChinese ? entry.descriptionZh : entry.description}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setShowRules((value) => !value)}>
            <BookOpen />{showRules ? (isChinese ? "收起规则" : "Hide rules") : (isChinese ? "规则与数学" : "Rules & math")}
          </Button>
        </header>

        {showRules ? (
          <section className="theme-panel-surface mb-6 grid gap-4 rounded-3xl border border-border/50 p-5 md:grid-cols-3">
            <div className="md:col-span-2">
              <p className="font-medium text-foreground">{isChinese ? rules.shortDescription.zh : rules.shortDescription.en}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {(isChinese ? entry.tableNotesZh : entry.tableNotes).map((note) => (
                  <p key={note} className="rounded-xl border border-border/50 bg-background/55 p-3 text-sm leading-6 text-muted-foreground">{note}</p>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
              <ShieldCheck className="mb-3 text-primary" />
              {isChinese
                ? "概率、赔率与期望值来自和服务端结算共用的版本化规则。动画只负责展示，不能写入结果或余额。"
                : "Probability, odds and expected value come from the same versioned rules used by server settlement. Presentation cannot write results or balances."}
            </div>
          </section>
        ) : null}

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="theme-panel-surface rounded-2xl border border-border/50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{isChinese ? "主钱包" : "Main wallet"}</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{formatAmount(walletBalance)}</p>
          </div>
          <div className="theme-panel-surface rounded-2xl border border-border/50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{isChinese ? "桌台筹码" : "Table chips"}</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{formatAmount(bankroll)}</p>
          </div>
          <div className="theme-panel-surface rounded-2xl border border-border/50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{isChinese ? "累计记录" : "Member record"}</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{initialProgress?.plays ?? recentRounds.length}</p>
          </div>
        </section>

        {!tableSession ? (
          <section className="theme-hero-surface mb-6 rounded-3xl border border-border/50 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                {isChinese ? "买入金额" : "Buy-in amount"}
                <input
                  type="number"
                  min={1}
                  max={1_000_000}
                  value={buyInAmount}
                  onChange={(event) => setBuyInAmount(Number(event.target.value))}
                  className="h-11 w-56 rounded-xl border border-border bg-background px-4"
                />
              </label>
              <Button type="button" size="lg" disabled={busy !== null} onClick={buyIn}>
                <Landmark />{busy === "buy-in" ? (isChinese ? "买入中…" : "Buying in…") : (isChinese ? "进入桌台" : "Enter table")}
              </Button>
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <section className="theme-hero-surface rounded-3xl border border-border/50 p-5 md:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{isChinese ? "当前下注面额" : "Current chip"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[10, 25, 50, 100, 250].map((amount) => (
                    <Button key={amount} type="button" size="sm" variant={stake === amount ? "default" : "outline"} disabled={pendingRound !== null} onClick={() => setStake(amount)}>
                      {formatAmount(amount)}
                    </Button>
                  ))}
                </div>
              </div>
              <Button type="button" variant="ghost" onClick={() => setBets({})} disabled={busy !== null || pendingRound !== null || activeStake === 0}>
                <RotateCcw />{isChinese ? "清空下注" : "Clear bets"}
              </Button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rules.betOptions.map((option) => {
                const amount = bets[option.key] ?? 0
                return (
                  <button
                    key={option.key}
                    type="button"
                    disabled={!tableSession || busy !== null || pendingRound !== null}
                    onClick={() => addBet(option.key)}
                    className={cn(
                      "group min-h-32 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-55",
                      amount > 0 ? "border-primary bg-primary/10 shadow-sm" : "border-border/60 bg-background/60 hover:border-primary/50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-11 min-w-11 items-center justify-center rounded-xl bg-card px-2 text-xl font-semibold text-foreground shadow-sm">
                        {symbolGlyphs[option.key] ?? option.key.replace("remainder:", "").replace("number:", "")}
                      </span>
                      <Badge variant={amount > 0 ? "default" : "outline"}>{amount > 0 ? formatAmount(amount) : formatOdds(option.netOdds.min, option.netOdds.max)}</Badge>
                    </div>
                    <p className="mt-3 font-semibold text-foreground">{isChinese ? option.labels.zh : option.labels.en}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      P {(option.probability * 100).toFixed(2)}% · EV {(option.expectedValue * 100).toFixed(2)}%
                    </p>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-border/50 bg-card/65 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{isChinese ? "总下注 / 理论期望" : "Total stake / theoretical EV"}</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{formatAmount(activeStake)} / {expectedValue >= 0 ? "+" : ""}{formatAmount(expectedValue)}</p>
                </div>
                <Button type="button" size="lg" disabled={!tableSession || busy !== null || activeStake <= 0} onClick={settleRound}>
                  <Play />{busy === "settle"
                    ? (isChinese ? "权威结算中…" : "Settling…")
                    : pendingRound
                      ? (isChinese ? "重试同一回合" : "Retry same round")
                      : (isChinese ? "开始回合" : "Play round")}
                </Button>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="theme-panel-surface rounded-3xl border border-border/50 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-foreground">{isChinese ? "最新权威结果" : "Latest authoritative result"}</h2>
                {latest ? <Badge variant={latest.outcome === "win" ? "default" : latest.outcome === "loss" ? "destructive" : "outline"}>{latest.outcome}</Badge> : null}
              </div>
              <div className="mt-4 flex min-h-24 items-center justify-center gap-3 rounded-2xl border border-border/50 bg-background/60 p-4">
                {latest ? resultTokens(latest.resultSnapshot, isChinese).map((token, index) => (
                  <span key={`${token}-${index}`} className="flex h-16 min-w-16 items-center justify-center rounded-2xl bg-card px-3 text-2xl font-semibold shadow-sm">
                    {symbolGlyphs[token] ?? token}
                  </span>
                )) : <span className="text-sm text-muted-foreground">{isChinese ? "尚无结果" : "No result yet"}</span>}
              </div>
              {latest ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{latest.resultSummary}</p> : null}
            </section>

            {tableSession ? (
              <Button type="button" variant="outline" className="w-full" disabled={busy !== null || pendingRound !== null} onClick={cashOut}>
                <LogOut />{busy === "cash-out" ? (isChinese ? "离桌中…" : "Cashing out…") : (isChinese ? "结算并离桌" : "Cash out")}
              </Button>
            ) : null}
          </aside>
        </div>

        <section className="theme-panel-surface mt-6 rounded-3xl border border-border/50 p-5">
          <h2 className="font-semibold text-foreground">{isChinese ? "最近回合" : "Recent rounds"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recentRounds.length ? recentRounds.map((round) => (
              <article key={round.id} className="rounded-2xl border border-border/50 bg-background/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant={round.outcome === "win" ? "default" : round.outcome === "loss" ? "destructive" : "outline"}>{round.outcome}</Badge>
                  <span className={cn("font-semibold", round.delta >= 0 ? "text-primary" : "text-destructive")}>{round.delta >= 0 ? "+" : ""}{formatAmount(round.delta)}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{round.resultSummary}</p>
                <p className="mt-2 text-xs text-muted-foreground">{roundBets(round).map((bet) => `${bet.key} ${formatAmount(bet.amount)}`).join(" · ")}</p>
              </article>
            )) : <p className="text-sm text-muted-foreground">{isChinese ? "完成第一回合后，权威记录会显示在这里。" : "Authoritative history appears after the first round."}</p>}
          </div>
        </section>
      </div>
    </main>
  )
}
