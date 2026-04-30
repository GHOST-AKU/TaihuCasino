"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  CircleDollarSign,
  Dices,
  History,
  Settings,
  Sparkles,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/hooks/use-language"
import { type Language } from "@/lib/home-content"
import { playableTableEntries, type CasinoTableEntry } from "@/lib/game-catalog"
import { cn } from "@/lib/utils"

type Outcome = "win" | "loss" | "push"
type BaccaratPick = "player" | "banker" | "tie"
type RoulettePick = "red" | "black" | "green"
type DicePick = "high" | "low"

interface RoundRecord {
  id: string
  label: string
  detail: string
  outcome: Outcome
  delta: number
  bankroll: number
  createdAt: string
}

interface GameStats {
  plays: number
  wins: number
  losses: number
  streak: number
}

const initialStats: GameStats = {
  plays: 0,
  wins: 0,
  losses: 0,
  streak: 0,
}

const redNumbers = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
])

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function drawCard() {
  return randomInt(1, 13)
}

function cardValue(card: number) {
  if (card === 1) {
    return 11
  }

  return Math.min(card, 10)
}

function handTotal(cards: number[]) {
  let total = cards.reduce((sum, card) => sum + cardValue(card), 0)
  let aces = cards.filter((card) => card === 1).length

  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }

  return total
}

function baccaratPoint() {
  return randomInt(0, 9)
}

function formatDelta(delta: number) {
  if (delta === 0) {
    return "$0"
  }

  return `${delta > 0 ? "+" : "-"}$${Math.abs(delta).toLocaleString()}`
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function makeRecord({
  label,
  detail,
  outcome,
  delta,
  bankroll,
}: Omit<RoundRecord, "id" | "createdAt">): RoundRecord {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label,
    detail,
    outcome,
    delta,
    bankroll,
    createdAt: new Date().toISOString(),
  }
}

function getCopy(language: Language, entry: CasinoTableEntry) {
  const isChinese = language === "zh"

  return {
    back: isChinese ? "返回大厅" : "Back to lobby",
    tableBadge: isChinese ? "实况桌台" : "Live table",
    variant: isChinese ? "高限额" : "High limit",
    credits: isChinese ? "可用筹码" : "Bankroll",
    memberRecord: isChinese ? "会员记录" : "Member record",
    memberOn: isChinese ? "已开启" : "On",
    roundHistory: isChinese ? "牌局记录" : "Round history",
    tableNotes: isChinese ? "玩法提示" : "Table notes",
    progress: isChinese ? "战绩" : "Record",
    stake: isChinese ? "下注额" : "Stake",
    settleRound: isChinese ? "下注开局" : "Play hand",
    deal: isChinese ? "发牌" : "Deal",
    hit: isChinese ? "补牌" : "Hit",
    stand: isChinese ? "停牌" : "Stand",
    changeTable: isChinese ? "换桌" : "Change table",
    emptyHistory: isChinese
      ? "还没有牌局记录。下注后这里会显示最近几手结果。"
      : "No rounds yet. Place a bet to see the latest hands here.",
    saveNote: isChinese
      ? "会员牌局会同步到会员中心。"
      : "Member table history syncs to the member center.",
    title: isChinese ? entry.titleZh : entry.title,
  }
}

function nextStats(current: GameStats, outcome: Outcome): GameStats {
  return {
    plays: current.plays + 1,
    wins: current.wins + (outcome === "win" ? 1 : 0),
    losses: current.losses + (outcome === "loss" ? 1 : 0),
    streak: outcome === "win" ? current.streak + 1 : outcome === "loss" ? 0 : current.streak,
  }
}

export function GameTablePage({
  entry,
  defaultLanguage,
}: {
  entry: CasinoTableEntry
  defaultLanguage: Language
}) {
  const [language] = useLanguage(defaultLanguage)
  const [bankroll, setBankroll] = useState(25000)
  const [bet, setBet] = useState(entry.defaultBet)
  const [history, setHistory] = useState<RoundRecord[]>([])
  const [stats, setStats] = useState<GameStats>(initialStats)
  const [statusText, setStatusText] = useState("请选择筹码和下注区域，准备下一手。")
  const [baccaratPick, setBaccaratPick] = useState<BaccaratPick>("banker")
  const [roulettePick, setRoulettePick] = useState<RoulettePick>("red")
  const [dicePick, setDicePick] = useState<DicePick>("high")
  const [blackjackPlayer, setBlackjackPlayer] = useState<number[]>([])
  const [blackjackDealer, setBlackjackDealer] = useState<number[]>([])
  const [blackjackActive, setBlackjackActive] = useState(false)

  const copy = getCopy(language, entry)
  const tableDescription = language === "zh" ? entry.descriptionZh : entry.description
  const tableTone = language === "zh" ? entry.tableToneZh : entry.tableTone
  const tableNotes = language === "zh" ? entry.tableNotesZh : entry.tableNotes
  const siblingTables = useMemo(
    () => playableTableEntries.filter((table) => table.slug !== entry.slug),
    [entry.slug],
  )
  const playerTotal = handTotal(blackjackPlayer)
  const dealerTotal = handTotal(blackjackDealer)

  useEffect(() => {
    const storageKey = `taihu-game-progress-${entry.slug}`
    const saved = window.localStorage.getItem(storageKey)

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          bankroll?: number
          stats?: GameStats
          history?: RoundRecord[]
        }

        if (typeof parsed.bankroll === "number") {
          setBankroll(parsed.bankroll)
        }

        if (parsed.stats) {
          setStats(parsed.stats)
        }

        if (Array.isArray(parsed.history)) {
          setHistory(parsed.history.slice(0, 6))
        }
      } catch {
        window.localStorage.removeItem(storageKey)
      }
    }

  }, [entry.slug])

  function persistLocal(nextBankroll: number, nextHistory: RoundRecord[], nextStatsValue: GameStats) {
    window.localStorage.setItem(
      `taihu-game-progress-${entry.slug}`,
      JSON.stringify({
        bankroll: nextBankroll,
        history: nextHistory.slice(0, 6),
        stats: nextStatsValue,
      }),
    )
  }

  async function persistServer(record: RoundRecord) {
    await fetch("/api/member/progress", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        gameSlug: entry.slug,
        outcome: record.outcome,
        delta: record.delta,
        bankroll: record.bankroll,
        summary: record.detail,
      }),
    }).catch(() => null)
  }

  function commitRecord(record: RoundRecord) {
    const nextHistory = [record, ...history].slice(0, 6)
    const nextStatsValue = nextStats(stats, record.outcome)

    setBankroll(record.bankroll)
    setHistory(nextHistory)
    setStats(nextStatsValue)
    setStatusText(record.detail)
    persistLocal(record.bankroll, nextHistory, nextStatsValue)

    void persistServer(record)
  }

  function settleBaccarat() {
    const player = baccaratPoint()
    const banker = baccaratPoint()
    const winner: BaccaratPick = player === banker ? "tie" : player > banker ? "player" : "banker"
    const winnerLabel =
      language === "zh"
        ? winner === "player"
          ? "闲家"
          : winner === "banker"
            ? "庄家"
            : "和局"
        : winner.toUpperCase()
    const outcome: Outcome = baccaratPick === winner ? "win" : winner === "tie" && baccaratPick !== "tie" ? "push" : "loss"
    const payout = winner === "tie" && baccaratPick === "tie" ? bet * 8 : bet
    const delta = outcome === "win" ? payout : outcome === "loss" ? -bet : 0
    const nextBankroll = bankroll + delta

    commitRecord(
      makeRecord({
        label: "Baccarat",
        detail:
          language === "zh"
            ? `闲家 ${player} 点，庄家 ${banker} 点，${winnerLabel}胜出。`
            : `Player ${player}, Banker ${banker}. ${winnerLabel} resolves the shoe.`,
        outcome,
        delta,
        bankroll: nextBankroll,
      }),
    )
  }

  function settleRoulette() {
    const number = randomInt(0, 36)
    const color: RoulettePick = number === 0 ? "green" : redNumbers.has(number) ? "red" : "black"
    const outcome: Outcome = roulettePick === color ? "win" : "loss"
    const delta = outcome === "win" ? (color === "green" ? bet * 14 : bet) : -bet
    const nextBankroll = bankroll + delta

    commitRecord(
      makeRecord({
        label: "Roulette",
        detail:
          language === "zh"
            ? `轮盘停在 ${number}，结果为 ${color === "red" ? "红色" : color === "black" ? "黑色" : "绿色零号"}。`
            : `Wheel landed on ${number} ${color}.`,
        outcome,
        delta,
        bankroll: nextBankroll,
      }),
    )
  }

  function settleDice() {
    const first = randomInt(1, 6)
    const second = randomInt(1, 6)
    const total = first + second
    const result: DicePick = total >= 8 ? "high" : "low"
    const outcome: Outcome = dicePick === result ? "win" : "loss"
    const delta = outcome === "win" ? bet : -bet
    const nextBankroll = bankroll + delta

    commitRecord(
      makeRecord({
        label: "Dice",
        detail:
          language === "zh"
            ? `骰子 ${first} + ${second} = ${total}，${result === "high" ? "大" : "小"}胜。`
            : `Rolled ${first} + ${second} = ${total}. ${result.toUpperCase()} wins.`,
        outcome,
        delta,
        bankroll: nextBankroll,
      }),
    )
  }

  function settleServiceRound() {
    const score = randomInt(62, 100)
    const outcome: Outcome = score >= 84 ? "win" : score >= 74 ? "push" : "loss"
    const delta = outcome === "win" ? bet : outcome === "loss" ? -Math.ceil(bet / 2) : 0
    const nextBankroll = bankroll + delta

    commitRecord(
      makeRecord({
        label: "Service",
        detail:
          language === "zh"
            ? `本次会员服务评分为 ${score}/100。`
            : `Service quality scored ${score}/100 for this member request.`,
        outcome,
        delta,
        bankroll: nextBankroll,
      }),
    )
  }

  function dealBlackjack() {
    const player = [drawCard(), drawCard()]
    const dealer = [drawCard(), drawCard()]
    setBlackjackPlayer(player)
    setBlackjackDealer(dealer)
    setBlackjackActive(true)
    setStatusText(
      language === "zh"
        ? `玩家 ${handTotal(player)} 点，庄家明牌 ${cardValue(dealer[0])} 点。`
        : `Player ${handTotal(player)} vs dealer showing ${cardValue(dealer[0])}.`,
    )
  }

  function settleBlackjack(playerCards = blackjackPlayer, dealerCards = blackjackDealer) {
    let finalDealer = [...dealerCards]
    let finalDealerTotal = handTotal(finalDealer)
    const finalPlayerTotal = handTotal(playerCards)

    while (finalDealerTotal < 17) {
      finalDealer = [...finalDealer, drawCard()]
      finalDealerTotal = handTotal(finalDealer)
    }

    const outcome: Outcome =
      finalPlayerTotal > 21
        ? "loss"
        : finalDealerTotal > 21 || finalPlayerTotal > finalDealerTotal
          ? "win"
          : finalPlayerTotal === finalDealerTotal
            ? "push"
            : "loss"
    const delta = outcome === "win" ? bet : outcome === "loss" ? -bet : 0
    const nextBankroll = bankroll + delta

    setBlackjackDealer(finalDealer)
    setBlackjackActive(false)
    commitRecord(
      makeRecord({
        label: "Blackjack",
        detail:
          language === "zh"
            ? `玩家 ${finalPlayerTotal} 点，庄家 ${finalDealerTotal} 点。`
            : `Player ${finalPlayerTotal}, Dealer ${finalDealerTotal}.`,
        outcome,
        delta,
        bankroll: nextBankroll,
      }),
    )
  }

  function hitBlackjack() {
    const nextHand = [...blackjackPlayer, drawCard()]
    setBlackjackPlayer(nextHand)

    if (handTotal(nextHand) > 21) {
      settleBlackjack(nextHand, blackjackDealer)
      return
    }

    setStatusText(language === "zh" ? `玩家当前 ${handTotal(nextHand)} 点。` : `Player total is now ${handTotal(nextHand)}.`)
  }

  function playPrimaryRound() {
    if (entry.ruleSet === "roulette") {
      settleRoulette()
      return
    }

    if (entry.ruleSet === "dice") {
      settleDice()
      return
    }

    if (entry.ruleSet === "service") {
      settleServiceRound()
      return
    }

    settleBaccarat()
  }

  return (
    <main className="theme-shell relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="theme-ambient-orb absolute -left-16 top-24 h-72 w-72 rounded-full blur-3xl" />
        <div className="theme-ambient-orb theme-ambient-orb-secondary absolute right-0 top-0 h-96 w-96 rounded-full blur-3xl" />
        <div className="theme-grid-mask absolute inset-0 opacity-60" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon">
              <Link href={`/?lang=${language}`} aria-label={copy.back}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Dices className="h-3.5 w-3.5" />
                  {copy.tableBadge}
                </Badge>
                {entry.variantOf ? <Badge variant="outline">{copy.variant}</Badge> : null}
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                {copy.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/member/settings">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </Button>
          </div>
        </header>

        <section className="theme-hero-surface mb-6 rounded-3xl border border-border/50 p-5 md:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-sm leading-7 text-muted-foreground">{tableDescription}</p>
              <p className="mt-3 text-base font-medium text-foreground">{tableTone}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{copy.credits}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">${bankroll.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{copy.progress}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{stats.wins}/{stats.plays}</p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{copy.memberRecord}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{copy.memberOn}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border/50 bg-background/70 p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{copy.stake}</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">${bet.toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  {[50, 100, 250, 500].map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      size="sm"
                      variant={bet === amount ? "default" : "outline"}
                      onClick={() => setBet(amount)}
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mb-4 rounded-2xl border border-border/50 bg-card/60 p-4 text-sm text-muted-foreground">
                {statusText}
              </div>

              {entry.ruleSet === "blackjack" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <HandPanel label={language === "zh" ? "玩家" : "Player"} cards={blackjackPlayer} total={playerTotal} />
                    <HandPanel label={language === "zh" ? "庄家" : "Dealer"} cards={blackjackDealer} total={dealerTotal} />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" onClick={dealBlackjack}>
                      <Sparkles className="h-4 w-4" />
                      {copy.deal}
                    </Button>
                    <Button type="button" variant="outline" disabled={!blackjackActive} onClick={hitBlackjack}>
                      {copy.hit}
                    </Button>
                    <Button type="button" variant="outline" disabled={!blackjackActive} onClick={() => settleBlackjack()}>
                      {copy.stand}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <RuleControls
                    entry={entry}
                    language={language}
                    baccaratPick={baccaratPick}
                    roulettePick={roulettePick}
                    dicePick={dicePick}
                    onBaccaratPick={setBaccaratPick}
                    onRoulettePick={setRoulettePick}
                    onDicePick={setDicePick}
                  />
                  <Button type="button" size="lg" onClick={playPrimaryRound}>
                    <Dices className="h-4 w-4" />
                    {entry.ruleSet === "service" ? (language === "zh" ? "完成服务" : "Complete service") : copy.settleRound}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <section className="theme-panel-surface rounded-2xl border border-border/50 p-5">
            <div className="mb-4 flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">{copy.roundHistory}</h2>
            </div>
            <div className="space-y-3">
              {history.length > 0 ? (
                history.map((record) => (
                  <div
                    key={record.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={record.outcome === "win" ? "default" : record.outcome === "loss" ? "destructive" : "outline"}
                        >
                          {record.outcome}
                        </Badge>
                        <p className="text-sm font-medium text-foreground">{record.label}</p>
                        <span className="text-xs text-muted-foreground">{formatTime(record.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{record.detail}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className={cn("text-lg font-semibold", record.delta >= 0 ? "text-primary" : "text-destructive")}>
                        {formatDelta(record.delta)}
                      </p>
                      <p className="text-xs text-muted-foreground">${record.bankroll.toLocaleString()} bankroll</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
                  {copy.emptyHistory}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="theme-panel-surface rounded-2xl border border-border/50 p-5">
              <div className="mb-4 flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">{copy.tableNotes}</h2>
              </div>
              <div className="space-y-3">
                {tableNotes.map((note) => (
                  <div key={note} className="rounded-xl border border-border/50 bg-background/60 p-3 text-sm text-muted-foreground">
                    {note}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-6 text-muted-foreground">{copy.saveNote}</p>
            </section>

            <section className="theme-panel-surface rounded-2xl border border-border/50 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Dices className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">{copy.changeTable}</h2>
              </div>
              <div className="grid gap-2">
                {siblingTables.slice(0, 6).map((table) => (
                  <Button key={table.slug} asChild variant="outline" className="justify-between">
                    <Link href={table.targetRoute}>
                      {language === "zh" ? table.titleZh : table.title}
                      <CircleDollarSign className="h-4 w-4" />
                    </Link>
                  </Button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}

function HandPanel({ label, cards, total }: { label: string; cards: number[]; total: number }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <Badge variant="outline">{total || "--"}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {cards.length > 0 ? (
          cards.map((card, index) => (
            <span
              key={`${card}-${index}`}
              className="flex h-12 w-9 items-center justify-center rounded-md border border-border/60 bg-card text-sm font-semibold text-foreground"
            >
              {card === 1 ? "A" : card > 10 ? ["J", "Q", "K"][card - 11] : card}
            </span>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">No cards</span>
        )}
      </div>
    </div>
  )
}

function RuleControls({
  entry,
  language,
  baccaratPick,
  roulettePick,
  dicePick,
  onBaccaratPick,
  onRoulettePick,
  onDicePick,
}: {
  entry: CasinoTableEntry
  language: Language
  baccaratPick: BaccaratPick
  roulettePick: RoulettePick
  dicePick: DicePick
  onBaccaratPick: (value: BaccaratPick) => void
  onRoulettePick: (value: RoulettePick) => void
  onDicePick: (value: DicePick) => void
}) {
  if (entry.ruleSet === "roulette") {
    return (
      <div className="flex flex-wrap gap-2">
        {(["red", "black", "green"] satisfies RoulettePick[]).map((pick) => (
          <Button
            key={pick}
            type="button"
            variant={roulettePick === pick ? "default" : "outline"}
            onClick={() => onRoulettePick(pick)}
          >
            {language === "zh" ? (pick === "red" ? "红" : pick === "black" ? "黑" : "零号") : pick}
          </Button>
        ))}
      </div>
    )
  }

  if (entry.ruleSet === "dice") {
    return (
      <div className="flex flex-wrap gap-2">
        {(["high", "low"] satisfies DicePick[]).map((pick) => (
          <Button
            key={pick}
            type="button"
            variant={dicePick === pick ? "default" : "outline"}
            onClick={() => onDicePick(pick)}
          >
            {language === "zh" ? (pick === "high" ? "大" : "小") : pick}
          </Button>
        ))}
      </div>
    )
  }

  if (entry.ruleSet === "service") {
    return (
      <div className="rounded-2xl border border-border/50 bg-background/60 p-4 text-sm text-muted-foreground">
        {language === "zh"
          ? "服务局会评估响应、出品和送达时间。高评分增加会员礼遇，低评分扣减少量体验额度。"
          : "Service rounds score responsiveness, presentation and delivery timing. Strong service adds a member perk; weak service removes a small credit adjustment."}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(["player", "banker", "tie"] satisfies BaccaratPick[]).map((pick) => (
        <Button
          key={pick}
          type="button"
          variant={baccaratPick === pick ? "default" : "outline"}
          onClick={() => onBaccaratPick(pick)}
        >
          {language === "zh" ? (pick === "player" ? "闲家" : pick === "banker" ? "庄家" : "和局") : pick}
        </Button>
      ))}
    </div>
  )
}
