"use client"

import Link from "next/link"
import { memo, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  BookOpen,
  CircleDollarSign,
  History,
  Martini,
  Settings,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useLanguage } from "@/hooks/use-language"
import type { BlackjackAction, BlackjackRoundView, BlackjackVisibleCard } from "@/lib/blackjack-engine"
import type { CasinoTableEntry } from "@/lib/game-catalog"
import type { MemberGameProgress, MemberGameRound, MemberTableSession } from "@/lib/member-data"
import { recordClientBlackjackAction, recordClientGameRound } from "@/lib/member-round-client"
import { cashOutClientTableSession, openClientTableSession } from "@/lib/table-session-client"
import { cn } from "@/lib/utils"

type Language = "zh" | "en"
type PlayerHand = BlackjackRoundView["playerHands"][number]

interface BlackjackStats {
  plays: number
  wins: number
  losses: number
  pushes: number
  totalStake: number
  recentDelta: number
  blackjacks: number
}

const STAKE_STORAGE_VERSION = "v2"
const CHIP_OPTIONS = [10, 25, 50, 100, 250] as const

const moneyFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

const timeFormatters: Record<Language, Intl.DateTimeFormat> = {
  zh: new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
  en: new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
}

const actionLabels: Record<BlackjackAction, { en: string; zh: string }> = {
  hit: { en: "Hit", zh: "要牌" },
  stand: { en: "Stand", zh: "停牌" },
  double: { en: "Double", zh: "加倍" },
  split: { en: "Split", zh: "分牌" },
  buy_insurance: { en: "Insurance", zh: "买保险" },
  skip_insurance: { en: "No insurance", zh: "不要保险" },
}

function formatMoney(value: number) {
  return moneyFormatter.format(value)
}

function formatDelta(value: number) {
  if (value === 0) return "0"
  return `${value > 0 ? "+" : "−"}${formatMoney(Math.abs(value))}`
}

function formatTime(value: string, language: Language) {
  return timeFormatters[language].format(new Date(value))
}

function roundResultMessage(
  outcome: MemberGameRound["outcome"],
  delta: number,
  fallback: string,
  isChinese: boolean,
) {
  if (!isChinese) return fallback
  const result = outcome === "win" ? "胜" : outcome === "loss" ? "负" : "和"
  return `本手${result}，筹码 ${formatDelta(delta)}。`
}

function countRoundBlackjacks(round: MemberGameRound) {
  const hands = round.resultSnapshot.playerHands
  if (!Array.isArray(hands)) return 0

  return hands.reduce((count, hand) => (
    hand && typeof hand === "object" && "naturalBlackjack" in hand && hand.naturalBlackjack === true
      ? count + 1
      : count
  ), 0)
}

function initialStats(progress: MemberGameProgress | null, rounds: MemberGameRound[]): BlackjackStats {
  const blackjackRounds = rounds.filter((round) => round.gameSlug === "blackjack")

  return {
    plays: progress?.plays ?? blackjackRounds.length,
    wins: progress?.wins ?? blackjackRounds.filter((round) => round.outcome === "win").length,
    losses: progress?.losses ?? blackjackRounds.filter((round) => round.outcome === "loss").length,
    pushes: progress
      ? Math.max(0, progress.plays - progress.wins - progress.losses)
      : blackjackRounds.filter((round) => round.outcome === "push").length,
    totalStake: blackjackRounds.reduce((total, round) => total + round.totalStake, 0),
    recentDelta: blackjackRounds.reduce((total, round) => total + round.delta, 0),
    blackjacks: blackjackRounds.reduce((total, round) => total + countRoundBlackjacks(round), 0),
  }
}

function statsAfterRound(stats: BlackjackStats, round: NonNullable<BlackjackRoundView["round"]>): BlackjackStats {
  const blackjacks = Array.isArray(round.resultSnapshot.playerHands)
    ? round.resultSnapshot.playerHands.filter((hand) => (
      hand && typeof hand === "object" && "naturalBlackjack" in hand && hand.naturalBlackjack === true
    )).length
    : 0

  return {
    plays: stats.plays + 1,
    wins: stats.wins + (round.outcome === "win" ? 1 : 0),
    losses: stats.losses + (round.outcome === "loss" ? 1 : 0),
    pushes: stats.pushes + (round.outcome === "push" ? 1 : 0),
    totalStake: stats.totalStake + round.totalStake,
    recentDelta: stats.recentDelta + round.delta,
    blackjacks: stats.blackjacks + blackjacks,
  }
}

function actionLabel(action: BlackjackAction, language: Language) {
  return actionLabels[action][language]
}

function phaseCopy(round: BlackjackRoundView | null, isChinese: boolean) {
  if (!round) {
    return {
      title: isChinese ? "等待开局" : "Ready",
      detail: isChinese ? "选好主注后开始新一手。" : "Choose a stake to start a hand.",
    }
  }

  if (round.phase === "insurance") {
    return {
      title: isChinese ? "保险决策" : "Insurance",
      detail: isChinese ? "庄家明牌为 A，请决定是否购买保险。" : "Dealer shows an Ace. Choose whether to insure.",
    }
  }

  if (round.phase === "player_turn") {
    return {
      title: isChinese ? "轮到你" : "Your turn",
      detail: isChinese ? "根据手牌选择要牌、停牌、加倍或分牌。" : "Choose hit, stand, double, or split when available.",
    }
  }

  if (round.phase === "dealer_turn") {
    return {
      title: isChinese ? "庄家行动" : "Dealer turn",
      detail: isChinese ? "庄家正在按 S17 规则完成牌局。" : "Dealer is completing the hand under S17 rules.",
    }
  }

  if (round.phase === "settled") {
    return {
      title: isChinese ? "本手完成" : "Hand complete",
      detail: isChinese ? "结算已经记入桌台筹码与牌局记录。" : "Settlement is reflected in chips and history.",
    }
  }

  return {
    title: isChinese ? "本手已作废" : "Hand voided",
    detail: isChinese ? "筹码没有发生变化，可以重新开局。" : "No chips moved. You can start again.",
  }
}

function outcomeLabel(outcome: MemberGameRound["outcome"], isChinese: boolean) {
  if (outcome === "win") return isChinese ? "胜" : "Win"
  if (outcome === "loss") return isChinese ? "负" : "Loss"
  return isChinese ? "和" : "Push"
}

function handStatusLabel(status: PlayerHand["status"], isChinese: boolean) {
  if (status === "active") return isChinese ? "行动中" : "Active"
  if (status === "standing") return isChinese ? "已停牌" : "Standing"
  if (status === "busted") return isChinese ? "爆牌" : "Busted"
  return isChinese ? "已结算" : "Settled"
}

function dealerNote(round: BlackjackRoundView | null, isChinese: boolean) {
  if (!round) return isChinese ? "等待发牌" : "Waiting for deal"
  if (round.dealer.holeCardHidden) return isChinese ? "暗牌将在结算时翻开" : "Hole card reveals at settlement"
  if (round.dealer.total !== null) return isChinese ? `庄家 ${round.dealer.total} 点` : `Dealer total ${round.dealer.total}`
  return isChinese ? "最终牌面" : "Final cards"
}

function newCommandId(action: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `blackjack-${action}-${crypto.randomUUID()}`
  }

  return `blackjack-${action}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function BlackjackTablePage({
  entry,
  defaultLanguage,
  initialWalletBalance,
  initialProgress,
  initialTableSession,
  initialBlackjackRound,
  initialGameRounds = [],
}: {
  entry: CasinoTableEntry
  defaultLanguage: Language
  initialWalletBalance: number
  initialProgress: MemberGameProgress | null
  initialTableSession: MemberTableSession | null
  initialBlackjackRound?: BlackjackRoundView | null
  initialGameRounds?: MemberGameRound[]
}) {
  const [language] = useLanguage(defaultLanguage)
  const isChinese = language === "zh"
  const legacyStorageKey = `taihu-blackjack-table-${entry.slug}`
  const storageKey = `${legacyStorageKey}:${STAKE_STORAGE_VERSION}`
  const latestRound = initialGameRounds[0] ?? null
  const [tableSession, setTableSession] = useState<MemberTableSession | null>(initialTableSession)
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance)
  const [bankroll, setBankroll] = useState(initialTableSession?.chipBalance ?? 0)
  const [buyInAmount, setBuyInAmount] = useState(100)
  const [stake, setStake] = useState(entry.defaultBet || 50)
  const [blackjackRound, setBlackjackRound] = useState<BlackjackRoundView | null>(initialBlackjackRound ?? null)
  const [lastRound, setLastRound] = useState<MemberGameRound | null>(latestRound)
  const [stats, setStats] = useState<BlackjackStats>(() => initialStats(initialProgress, initialGameRounds))
  const [isOpeningSession, setIsOpeningSession] = useState(false)
  const [isCashingOut, setIsCashingOut] = useState(false)
  const [isActing, setIsActing] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [message, setMessage] = useState(
    initialBlackjackRound
      ? isChinese ? "欢迎回来，未完成的牌局已经恢复。" : "Welcome back. Your active hand was restored."
      : latestRound
        ? roundResultMessage(latestRound.outcome, latestRound.delta, latestRound.resultSummary, isChinese)
        : isChinese ? "买入桌台筹码，选好主注后开始。" : "Buy in, choose a stake, and start a hand.",
  )

  const activeRound = blackjackRound?.status === "active" ? blackjackRound : null
  const tableSessionActive = tableSession?.status === "active"
  const currentPhase = phaseCopy(blackjackRound, isChinese)
  const activeHand = activeRound?.playerHands.find((hand) => hand.handId === activeRound.currentHandId) ?? null
  const displayedStake = activeRound?.stake ?? stake
  const roundDelta = blackjackRound?.delta ?? lastRound?.delta ?? 0
  const canDeal = Boolean(tableSessionActive && !activeRound && !isActing && stake > 0 && bankroll >= stake)

  const recentRounds = useMemo(() => {
    const uniqueRounds = new Map<string, MemberGameRound>()
    if (lastRound) uniqueRounds.set(lastRound.id, lastRound)
    for (const round of initialGameRounds) uniqueRounds.set(round.id, round)
    return Array.from(uniqueRounds.values()).slice(0, 8)
  }, [initialGameRounds, lastRound])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey) ?? window.localStorage.getItem(legacyStorageKey)
      if (!saved) return

      const parsed = JSON.parse(saved) as { stake?: unknown }
      if (typeof parsed.stake === "number" && Number.isFinite(parsed.stake) && parsed.stake > 0) {
        setStake(parsed.stake)
      }
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [legacyStorageKey, storageKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ stake }))
    } catch {
      // Private browsing and disabled storage should not block gameplay.
    }
  }, [stake, storageKey])

  function applyFinalRound(round: NonNullable<BlackjackRoundView["round"]>) {
    setBankroll(round.chipBalanceAfter)
    setStats((current) => statsAfterRound(current, round))
    setLastRound({
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
      idempotencyKey: null,
      createdAt: round.serverTimestamp,
    })
    setMessage(roundResultMessage(round.outcome, round.delta, round.summary, isChinese))
  }

  async function handleBuyIn() {
    if (isOpeningSession) return
    setIsOpeningSession(true)
    setMessage(isChinese ? "正在为你准备桌台筹码……" : "Preparing your table chips…")

    try {
      const result = await openClientTableSession(entry.slug, buyInAmount, `blackjack-buy-in-${Date.now()}`)
      setTableSession(result.tableSession)
      setBankroll(result.tableSession.chipBalance)
      setWalletBalance(result.walletBalance ?? Math.max(0, walletBalance - buyInAmount))
      setBlackjackRound(null)
      setMessage(isChinese ? "买入完成，选好主注即可发牌。" : "Buy-in complete. Choose a stake and deal.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "买入失败，请稍后重试。" : "Buy-in failed. Please try again.")
    } finally {
      setIsOpeningSession(false)
    }
  }

  async function handleCashOut() {
    if (!tableSession || isCashingOut || activeRound) return
    setIsCashingOut(true)
    setMessage(isChinese ? "正在把桌台筹码放回主钱包……" : "Returning table chips to your wallet…")

    try {
      const result = await cashOutClientTableSession(tableSession.id, `blackjack-cash-out-${Date.now()}`)
      setTableSession(result.tableSession)
      setWalletBalance(result.walletBalance ?? walletBalance + tableSession.chipBalance)
      setBankroll(result.tableSession.chipBalance)
      setMessage(isChinese ? "已离桌，筹码安全回到主钱包。" : "Cashed out. Your chips are back in the main wallet.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "离桌失败，请稍后重试。" : "Cash-out failed. Please try again.")
    } finally {
      setIsCashingOut(false)
    }
  }

  async function handleDeal() {
    if (!tableSession || activeRound || isActing) return
    setIsActing(true)
    setMessage(isChinese ? "正在发牌……" : "Dealing the hand…")

    try {
      const result = await recordClientGameRound({
        gameSlug: entry.slug,
        tableSessionId: tableSession.id,
        idempotencyKey: `blackjack-round-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        betSnapshot: { stake },
      })

      if (result.blackjackRound) {
        setBlackjackRound(result.blackjackRound)
        setMessage(isChinese ? "牌已发好，请选择可用动作。" : "Cards are dealt. Choose an available action.")
      }

      if (result.round) applyFinalRound(result.round)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "发牌失败，请稍后重试。" : "Deal failed. Please try again.")
    } finally {
      setIsActing(false)
    }
  }

  async function handleAction(action: BlackjackAction) {
    if (!activeRound || isActing) return
    setIsActing(true)
    setMessage(isChinese ? "正在确认你的选择……" : "Confirming your move…")

    try {
      const result = await recordClientBlackjackAction(activeRound.roundId, {
        commandId: newCommandId(action),
        expectedVersion: activeRound.version,
        action,
        handId: activeRound.currentHandId,
      })

      if (result.blackjackRound) setBlackjackRound(result.blackjackRound)

      if (result.round) {
        applyFinalRound(result.round)
      } else {
        setMessage(isChinese ? "选择已确认，请继续。" : "Move confirmed. Continue when ready.")
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "操作失败，请重试。" : "Move failed. Please try again.")
    } finally {
      setIsActing(false)
    }
  }

  return (
    <main
      className="game-table-shell lobby-shell min-h-screen overflow-hidden bg-background text-foreground"
      data-round-id={blackjackRound?.round?.roundId ?? blackjackRound?.roundId ?? lastRound?.id ?? ""}
    >
      <div className="mx-auto grid max-w-[1360px] gap-4 px-3 pb-28 pt-4 sm:px-5 lg:px-6 lg:pt-6 xl:pb-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={`/?lang=${language}`}
              className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#d0b06e]/35 bg-black/20 text-[#f8ecd2] transition hover:-translate-y-0.5 hover:bg-[#d0b06e]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={isChinese ? "返回大厅" : "Back to lobby"}
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d0b06e]">
                {isChinese ? "标准 S17 · 太湖牌桌" : "Standard S17 · Taihu table"}
              </p>
              <h1 className="truncate font-serif text-2xl font-semibold tracking-tight text-[#fff4d8] sm:text-3xl lg:text-4xl">
                {isChinese ? "21 点实桌" : "Blackjack table"}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button asChild variant="outline" className="h-10 rounded-xl bg-background/70 px-3 sm:px-4">
              <Link href="/games/cocktail-service" aria-label={isChinese ? "桌边饮品" : "Table drinks"}>
                <Martini className="size-4" />
                <span className="hidden sm:inline">{isChinese ? "桌边饮品" : "Table drinks"}</span>
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-label={isChinese ? "玩法说明" : "Rules"}
              onClick={() => setRulesOpen(true)}
              className="h-10 rounded-xl bg-background/70 px-3 sm:px-4"
            >
              <BookOpen className="size-4" />
              <span className="hidden sm:inline">{isChinese ? "玩法说明" : "Rules"}</span>
            </Button>
            <Button asChild variant="outline" size="icon" className="size-10 rounded-xl bg-background/70">
              <Link href="/member/settings" aria-label={isChinese ? "设置" : "Settings"}>
                <Settings className="size-4" />
              </Link>
            </Button>
          </div>
        </header>

        {!tableSessionActive ? (
          <BuyInPanel
            isChinese={isChinese}
            walletBalance={walletBalance}
            buyInAmount={buyInAmount}
            isOpening={isOpeningSession}
            onAmountChange={setBuyInAmount}
            onBuyIn={handleBuyIn}
          />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" aria-label={isChinese ? "牌桌概览" : "Table overview"}>
              <OverviewMetric icon={<WalletCards />} label={isChinese ? "主钱包" : "Main wallet"} value={formatMoney(walletBalance)} />
              <OverviewMetric icon={<CircleDollarSign />} label={isChinese ? "桌台筹码" : "Table chips"} value={formatMoney(bankroll)} emphasize />
              <OverviewMetric icon={<Sparkles />} label={isChinese ? "当前主注" : "Current stake"} value={formatMoney(displayedStake)} />
              <OverviewMetric
                icon={<ShieldCheck />}
                label={isChinese ? "本手盈亏" : "Hand delta"}
                value={formatDelta(roundDelta)}
                tone={roundDelta > 0 ? "good" : roundDelta < 0 ? "bad" : "neutral"}
              />
            </section>

            <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
              <div className="relative overflow-hidden rounded-[2rem] border border-emerald-900/25 bg-[#07533b] p-3 shadow-[0_28px_80px_rgba(2,44,31,0.22)] sm:p-5 lg:p-7">
                <div className="pointer-events-none absolute inset-4 rounded-[999px] border border-white/10 sm:inset-7" />
                <div className="pointer-events-none absolute inset-x-[8%] top-1/2 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                <div className="relative z-10 grid min-h-[31rem] grid-rows-[auto_1fr_auto] gap-5 sm:min-h-[35rem]">
                  <div className="flex flex-wrap items-start justify-between gap-3 text-white">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100/70">
                        {isChinese ? "本桌状态" : "Table status"}
                      </p>
                      <p className="mt-1 font-serif text-2xl font-semibold sm:text-3xl">{currentPhase.title}</p>
                      <p className="mt-1 max-w-xl text-sm leading-6 text-emerald-50/75">{currentPhase.detail}</p>
                    </div>
                    <span className="rounded-full border border-white/15 bg-black/10 px-3 py-1.5 text-xs font-semibold text-emerald-50/90 backdrop-blur">
                      {isChinese ? "庄家停牌 17" : "Dealer stands on 17"}
                    </span>
                  </div>

                  <div className="grid content-center gap-5">
                    <HandZone
                      title={isChinese ? "庄家" : "Dealer"}
                      cards={blackjackRound?.dealer.cards ?? []}
                      total={blackjackRound?.dealer.total ?? null}
                      hidden={Boolean(blackjackRound?.dealer.holeCardHidden)}
                      note={dealerNote(blackjackRound, isChinese)}
                      compact
                    />

                    <div className="grid gap-3 lg:grid-cols-2">
                      {(blackjackRound?.playerHands ?? []).length > 0 ? (
                        blackjackRound?.playerHands.map((hand, index) => (
                          <HandZone
                            key={hand.handId}
                            title={`${isChinese ? "你的手牌" : "Your hand"}${blackjackRound.playerHands.length > 1 ? ` ${index + 1}` : ""}`}
                            cards={hand.cards}
                            total={hand.total}
                            active={hand.handId === blackjackRound.currentHandId}
                            note={`${isChinese ? "主注" : "Bet"} ${formatMoney(hand.bet)} · ${handStatusLabel(hand.status, isChinese)}${hand.delta !== null ? ` · ${formatDelta(hand.delta)}` : ""}`}
                          />
                        ))
                      ) : (
                        <div className="col-span-full grid min-h-36 place-items-center rounded-[1.5rem] border border-dashed border-white/20 bg-black/10 p-6 text-center text-sm text-emerald-50/70">
                          <div>
                            <Sparkles className="mx-auto mb-3 size-6 text-amber-200" />
                            <p className="font-semibold text-white">{isChinese ? "牌桌已准备好" : "The table is ready"}</p>
                            <p className="mt-1">{isChinese ? "选择主注，然后发牌开局。" : "Choose your stake, then deal a new hand."}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/12 bg-black/15 px-4 py-3 text-sm leading-6 text-emerald-50/85 backdrop-blur" aria-live="polite">
                    {message}
                  </div>
                </div>
              </div>

              <aside className="grid gap-4 xl:sticky xl:top-4">
                <section className="rounded-[1.5rem] border border-[#d0b06e]/30 bg-black/20 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.14)] sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#d0b06e]">{isChinese ? "主注" : "Main stake"}</p>
                      <p className="mt-1 text-3xl font-black text-[#fff4d8]">{formatMoney(displayedStake)}</p>
                    </div>
                    <label className="sr-only" htmlFor="blackjackStakeInput">{isChinese ? "主注金额" : "Stake amount"}</label>
                    <input
                      id="blackjackStakeInput"
                      type="number"
                      min={1}
                      step={1}
                      value={displayedStake}
                      disabled={Boolean(activeRound)}
                      onChange={(event) => setStake(Math.max(1, Number(event.target.value) || 1))}
                      className="h-11 w-28 rounded-xl border border-[#d0b06e]/35 bg-black/25 px-3 text-right text-base font-black text-[#fff4d8] outline-none transition focus:border-[#f0cf83] disabled:opacity-50"
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-5 gap-2" aria-label={isChinese ? "快捷筹码" : "Quick chips"}>
                    {CHIP_OPTIONS.map((chip, index) => (
                      <ChipButton
                        key={chip}
                        value={chip}
                        colorIndex={index}
                        selected={displayedStake === chip}
                        disabled={Boolean(activeRound)}
                        onClick={() => setStake(chip)}
                      />
                    ))}
                  </div>

                  {!activeRound && stake > bankroll ? (
                    <p className="mt-3 text-xs font-semibold text-destructive">
                      {isChinese ? "桌台筹码不足，请降低主注。" : "Not enough table chips. Lower the stake."}
                    </p>
                  ) : null}
                </section>

                <section className="rounded-[1.5rem] border border-[#d0b06e]/30 bg-black/20 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.14)] sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#d0b06e]">{isChinese ? "你的选择" : "Your move"}</p>
                      <p className="mt-1 text-sm text-[#cbbd91]">{activeHand ? `${activeHand.total} ${isChinese ? "点" : "points"}` : currentPhase.title}</p>
                    </div>
                    {activeRound ? (
                      <span className="size-2.5 rounded-full bg-primary shadow-[0_0_0_5px_rgba(16,185,129,0.12)]" aria-label={isChinese ? "等待操作" : "Awaiting action"} />
                    ) : null}
                  </div>

                  <div className="mt-4 hidden grid-cols-2 gap-2 xl:grid">
                    {(activeRound?.allowedActions ?? []).map((action) => (
                      <Button
                        key={action}
                        type="button"
                        variant={action === "stand" || action === "skip_insurance" ? "outline" : "default"}
                        onClick={() => handleAction(action)}
                        disabled={isActing}
                        className="min-h-11 rounded-xl text-sm font-bold"
                      >
                        {actionLabel(action, language)}
                      </Button>
                    ))}
                  </div>

                  {!activeRound ? (
                    <Button
                      type="button"
                      onClick={handleDeal}
                      disabled={!canDeal}
                      className="mt-4 hidden h-12 w-full rounded-xl text-base font-bold shadow-[0_14px_32px_rgba(16,185,129,0.2)] xl:flex"
                    >
                      <Sparkles className="size-4" />
                      {isActing ? (isChinese ? "发牌中……" : "Dealing…") : (isChinese ? "发牌开局" : "Deal hand")}
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCashOut}
                    disabled={Boolean(activeRound) || isCashingOut}
                    className="mt-2 h-11 w-full rounded-xl"
                  >
                    {isCashingOut ? (isChinese ? "离桌中……" : "Cashing out…") : (isChinese ? "带走筹码" : "Cash out")}
                  </Button>
                </section>
              </aside>
            </section>

            <section className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
              <div className="rounded-[1.5rem] border border-[#d0b06e]/30 bg-black/20 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <h2 className="font-serif text-xl font-semibold text-[#fff4d8]">{isChinese ? "本桌战绩" : "Table record"}</h2>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <StatTile label={isChinese ? "局数" : "Hands"} value={String(stats.plays)} />
                  <StatTile label={isChinese ? "胜局" : "Wins"} value={String(stats.wins)} tone="good" />
                  <StatTile label={isChinese ? "和局" : "Pushes"} value={String(stats.pushes)} />
                  <StatTile label={isChinese ? "黑杰克" : "Blackjacks"} value={String(stats.blackjacks)} />
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl border border-[#d0b06e]/25 bg-black/20 px-3 py-2.5">
                  <span className="text-xs text-[#cbbd91]">{isChinese ? "近期净值" : "Recent net"}</span>
                  <span className={cn("font-black", stats.recentDelta > 0 && "text-emerald-500", stats.recentDelta < 0 && "text-destructive")}>
                    {formatDelta(stats.recentDelta)}
                  </span>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-[#d0b06e]/30 bg-black/20 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <History className="size-4 text-primary" />
                  <h2 className="font-serif text-xl font-semibold text-[#fff4d8]">{isChinese ? "最近牌局" : "Recent hands"}</h2>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {recentRounds.length > 0 ? recentRounds.map((round) => (
                    <RoundHistoryRow key={round.id} round={round} language={language} />
                  )) : (
                    <div className="col-span-full rounded-xl border border-dashed border-[#d0b06e]/30 p-5 text-center text-sm text-[#cbbd91]">
                      {isChinese ? "完成第一手后，这里会显示牌局记录。" : "Your completed hands will appear here."}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section
              className="fixed bottom-3 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-2xl border border-border/80 bg-background/95 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.28)] backdrop-blur-xl xl:hidden"
              aria-label={isChinese ? "移动端牌局操作" : "Mobile game actions"}
            >
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <p className="text-xs font-bold text-foreground">
                  {activeHand ? `${isChinese ? "你的手牌" : "Your hand"} · ${activeHand.total}` : currentPhase.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isChinese ? "主注" : "Stake"} {formatMoney(displayedStake)}
                </p>
              </div>

              {activeRound ? (
                <div className={cn("grid gap-2", activeRound.allowedActions.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
                  {activeRound.allowedActions.map((action) => (
                    <Button
                      key={action}
                      type="button"
                      variant={action === "stand" || action === "skip_insurance" ? "outline" : "default"}
                      onClick={() => handleAction(action)}
                      disabled={isActing}
                      className="min-h-11 rounded-xl text-sm font-bold"
                    >
                      {actionLabel(action, language)}
                    </Button>
                  ))}
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={handleDeal}
                  disabled={!canDeal}
                  className="h-11 w-full rounded-xl text-sm font-bold shadow-[0_12px_28px_rgba(16,185,129,0.2)]"
                >
                  <Sparkles className="size-4" />
                  {isActing ? (isChinese ? "发牌中……" : "Dealing…") : (isChinese ? "发牌开局" : "Deal hand")}
                </Button>
              )}
            </section>
          </>
        )}
      </div>

      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} isChinese={isChinese} />
    </main>
  )
}

function BuyInPanel({
  isChinese,
  walletBalance,
  buyInAmount,
  isOpening,
  onAmountChange,
  onBuyIn,
}: {
  isChinese: boolean
  walletBalance: number
  buyInAmount: number
  isOpening: boolean
  onAmountChange: (value: number) => void
  onBuyIn: () => void
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-[#d0b06e]/35 bg-black/20 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.12)] sm:p-7 lg:p-9">
      <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d0b06e]">{isChinese ? "入座准备" : "Take your seat"}</p>
          <h2 className="mt-2 max-w-2xl font-serif text-3xl font-semibold tracking-tight text-[#fff4d8] sm:text-4xl">
            {isChinese ? "把筹码带到 21 点桌" : "Bring chips to the blackjack table"}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#cbbd91]">
            {isChinese ? "买入只会把虚拟筹码从主钱包移到本桌；离桌时可全部带回。" : "Buy-in moves virtual chips from your wallet to this table. Cash out to return them."}
          </p>
          <p className="mt-5 text-sm text-[#cbbd91]">{isChinese ? "主钱包" : "Main wallet"}</p>
          <p className="mt-1 text-5xl font-black tracking-tight text-primary">{formatMoney(walletBalance)}</p>
        </div>

        <form
          className="grid gap-3 rounded-[1.5rem] border border-[#d0b06e]/30 bg-background/70 p-4 backdrop-blur sm:min-w-[23rem]"
          onSubmit={(event) => {
            event.preventDefault()
            void onBuyIn()
          }}
        >
          <label htmlFor="blackjackBuyInAmount" className="text-sm font-bold text-foreground">
            {isChinese ? "买入金额" : "Buy-in amount"}
          </label>
          <input
            id="blackjackBuyInAmount"
            type="number"
            min={1}
            max={1000000}
            step={1}
            value={buyInAmount}
            onChange={(event) => onAmountChange(Math.max(1, Number(event.target.value) || 1))}
            className="h-12 rounded-xl border border-input bg-card px-4 text-lg font-black outline-none transition focus:border-ring"
          />
          <div className="grid grid-cols-3 gap-2">
            {[100, 250, 500].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => onAmountChange(amount)}
                className={cn(
                  "h-10 rounded-xl border text-sm font-bold transition hover:-translate-y-0.5",
                  buyInAmount === amount ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/70 text-foreground",
                )}
              >
                {formatMoney(amount)}
              </button>
            ))}
          </div>
          <Button type="submit" disabled={isOpening || buyInAmount > walletBalance} className="h-12 rounded-xl text-base font-bold">
            {isOpening ? (isChinese ? "正在入座……" : "Taking your seat…") : (isChinese ? "买入并入座" : "Buy in")}
          </Button>
        </form>
      </div>
    </section>
  )
}

function OverviewMetric({
  icon,
  label,
  value,
  emphasize = false,
  tone = "neutral",
}: {
  icon: React.ReactNode
  label: string
  value: string
  emphasize?: boolean
  tone?: "good" | "bad" | "neutral"
}) {
  return (
    <div className={cn("rounded-2xl border border-[#d0b06e]/30 bg-black/20 p-3 sm:p-4", emphasize && "border-primary/30 bg-primary/5")}>
      <div className="flex items-center gap-2 text-xs text-[#cbbd91] [&_svg]:size-3.5">{icon}<span>{label}</span></div>
      <p className={cn(
        "mt-2 text-xl font-black tracking-tight text-[#fff4d8] sm:text-2xl",
        emphasize && "text-primary",
        tone === "good" && "text-emerald-500",
        tone === "bad" && "text-destructive",
      )}>
        {value}
      </p>
    </div>
  )
}

const HandZone = memo(function HandZone({
  title,
  cards,
  total,
  note,
  hidden = false,
  active = false,
  compact = false,
}: {
  title: string
  cards: BlackjackVisibleCard[]
  total: number | null
  note: string
  hidden?: boolean
  active?: boolean
  compact?: boolean
}) {
  return (
    <section className={cn(
      "rounded-[1.5rem] border bg-black/10 p-3 text-white backdrop-blur-sm transition sm:p-4",
      active ? "border-amber-200/70 shadow-[0_0_0_3px_rgba(253,230,138,0.12)]" : "border-white/15",
      compact && "mx-auto w-full max-w-2xl",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold sm:text-xl">{title}</h2>
          <p className="mt-0.5 text-xs text-emerald-50/65">{note}</p>
        </div>
        <span className="grid min-w-10 place-items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-sm font-black text-amber-100">
          {total ?? (cards.length > 0 ? "?" : "—")}
        </span>
      </div>
      <div className="mt-3 flex min-h-[6.5rem] flex-wrap items-center justify-center gap-2 sm:justify-start">
        {cards.length > 0 ? cards.map((card, index) => (
          <PlayingCard key={`${card.rank}-${card.suit}-${index}`} card={card} />
        )) : (
          <span className="text-sm text-emerald-50/60">—</span>
        )}
        {hidden ? <HiddenCard /> : null}
      </div>
    </section>
  )
})

const PlayingCard = memo(function PlayingCard({ card }: { card: BlackjackVisibleCard }) {
  const suit = suitLabel(card.suit)
  const red = card.suit === "hearts" || card.suit === "diamonds"

  return (
    <span
      data-testid={`blackjack-card-${rankLabel(card.rank)}-${card.suit}`}
      className={cn(
        "relative grid h-24 w-[4.35rem] shrink-0 place-items-center rounded-xl border border-black/10 bg-gradient-to-b from-[#fffdf5] to-[#efe6d2] text-2xl font-black text-[#15211c] shadow-[0_12px_22px_rgba(0,0,0,0.2)] transition-transform duration-300 motion-safe:hover:-translate-y-1 sm:h-28 sm:w-20",
        red && "text-[#c53d4b]",
      )}
      aria-label={`${rankLabel(card.rank)} ${suit}`}
    >
      <span className="absolute left-2 top-1.5 text-sm leading-none sm:text-base">{rankLabel(card.rank)}</span>
      <span aria-hidden="true">{suit}</span>
      <span className="absolute bottom-1.5 right-2 rotate-180 text-sm leading-none sm:text-base">{rankLabel(card.rank)}</span>
    </span>
  )
})

function HiddenCard() {
  return (
    <span
      data-testid="blackjack-card-hidden"
      className="relative grid h-24 w-[4.35rem] shrink-0 place-items-center overflow-hidden rounded-xl border border-amber-200/35 bg-[#103f31] text-xl font-black text-amber-100 shadow-[0_12px_22px_rgba(0,0,0,0.2)] sm:h-28 sm:w-20"
      aria-label="Hidden card"
    >
      <span className="absolute inset-1.5 rounded-lg border border-amber-200/20 bg-[radial-gradient(circle_at_center,rgba(253,230,138,0.18),transparent_60%)]" />
      <span className="relative">?</span>
    </span>
  )
}

function ChipButton({
  value,
  colorIndex,
  selected,
  disabled,
  onClick,
}: {
  value: number
  colorIndex: number
  selected: boolean
  disabled: boolean
  onClick: () => void
}) {
  const colors = [
    "from-[#f9de91] to-[#c7952f] text-[#3d2a0a]",
    "from-[#ffb3b3] to-[#c94d58] text-white",
    "from-[#acd0ff] to-[#4a78c7] text-white",
    "from-[#a8ebba] to-[#29965a] text-white",
    "from-[#dac0ff] to-[#7950b8] text-white",
  ]

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`Stake ${value}`}
      className={cn(
        "aspect-square min-w-0 rounded-full border-2 border-dashed border-white/60 bg-gradient-to-br p-1 text-[0.68rem] font-black shadow-[inset_0_2px_8px_rgba(255,255,255,0.35),0_6px_12px_rgba(0,0,0,0.16)] transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-45 sm:text-xs",
        colors[colorIndex % colors.length],
        selected && "outline outline-2 outline-offset-2 outline-primary",
      )}
    >
      {formatMoney(value)}
    </button>
  )
}

const StatTile = memo(function StatTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "good" | "neutral" }) {
  return (
    <div className="rounded-xl border border-[#d0b06e]/25 bg-black/20 p-3">
      <p className="text-xs text-[#cbbd91]">{label}</p>
      <p className={cn("mt-1 text-xl font-black text-[#fff4d8]", tone === "good" && "text-emerald-500")}>{value}</p>
    </div>
  )
})

function RoundHistoryRow({ round, language }: { round: MemberGameRound; language: Language }) {
  const isChinese = language === "zh"

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#d0b06e]/25 bg-black/20 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-[#fff4d8]">{outcomeLabel(round.outcome, isChinese)}</p>
        <p className="mt-0.5 text-xs text-[#cbbd91]">{formatTime(round.createdAt, language)} · {isChinese ? "主注" : "Stake"} {formatMoney(round.totalStake)}</p>
      </div>
      <span className={cn("shrink-0 font-black", round.delta > 0 && "text-emerald-500", round.delta < 0 && "text-destructive")}>
        {formatDelta(round.delta)}
      </span>
    </div>
  )
}

function RulesDialog({ open, onOpenChange, isChinese }: { open: boolean; onOpenChange: (open: boolean) => void; isChinese: boolean }) {
  const rules = isChinese
    ? [
        ["主注", "每手开始前选择一个基础主注。"],
        ["要牌", "继续拿牌；超过 21 点即爆牌。"],
        ["停牌", "保留当前点数，交给庄家行动。"],
        ["加倍", "仅两张牌时可用；主注翻倍、补一张牌并自动停牌。"],
        ["分牌", "两张同点值牌可拆成两手，分别完成。"],
        ["保险", "庄家明牌为 A 时开放，金额为基础主注的一半。"],
        ["庄家", "本桌采用 S17：庄家 17 点或以上停牌。"],
        ["黑杰克", "原始两张自然 21 按 3:2 结算。"],
      ]
    : [
        ["Main stake", "Choose one base stake before each hand."],
        ["Hit", "Take another card. Going over 21 busts the hand."],
        ["Stand", "Keep the current total and pass play to the dealer."],
        ["Double", "On two cards, double the stake, draw once, then stand."],
        ["Split", "Split two equal-value cards into separate hands."],
        ["Insurance", "Available when the dealer shows an Ace; costs half the base stake."],
        ["Dealer", "This table uses S17: the dealer stands on 17 or higher."],
        ["Blackjack", "A natural two-card 21 pays 3:2."],
      ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-[1.5rem] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{isChinese ? "21 点玩法说明" : "Blackjack rules"}</DialogTitle>
          <DialogDescription>{isChinese ? "标准主注、S17、一次分牌、加倍与保险。" : "Standard stake, S17, one split, double, and insurance."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {rules.map(([label, description]) => (
            <div key={label} className="grid gap-1 rounded-xl border border-border bg-card/50 p-3 sm:grid-cols-[8rem_1fr] sm:gap-3">
              <p className="font-bold text-primary">{label}</p>
              <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function rankLabel(rank: number) {
  if (rank === 1) return "A"
  if (rank === 11) return "J"
  if (rank === 12) return "Q"
  if (rank === 13) return "K"
  return String(rank)
}

function suitLabel(suit: BlackjackVisibleCard["suit"]) {
  if (suit === "spades") return "♠"
  if (suit === "hearts") return "♥"
  if (suit === "diamonds") return "♦"
  return "♣"
}
