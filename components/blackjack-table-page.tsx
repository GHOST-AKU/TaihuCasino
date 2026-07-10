"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import type { CasinoTableEntry } from "@/lib/game-catalog"
import type { MemberGameProgress, MemberGameRound, MemberTableSession } from "@/lib/member-data"
import { recordClientBlackjackAction, recordClientGameRound } from "@/lib/member-round-client"
import { cashOutClientTableSession, openClientTableSession } from "@/lib/table-session-client"
import type { BlackjackAction, BlackjackRoundView, BlackjackVisibleCard } from "@/lib/blackjack-engine"
import { useLanguage } from "@/hooks/use-language"

type Language = "zh" | "en"

interface BlackjackStats {
  plays: number
  wins: number
  losses: number
  pushes: number
  totalStake: number
  totalDelta: number
  blackjacks: number
}

const actionLabels: Record<BlackjackAction, { en: string, zh: string }> = {
  hit: { en: "Hit", zh: "要牌" },
  stand: { en: "Stand", zh: "停牌" },
  double: { en: "Double", zh: "加倍" },
  split: { en: "Split", zh: "分牌" },
  buy_insurance: { en: "Buy insurance", zh: "买保险" },
  skip_insurance: { en: "Skip insurance", zh: "跳过保险" },
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)
}

function initialStats(): BlackjackStats {
  return {
    plays: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    totalStake: 0,
    totalDelta: 0,
    blackjacks: 0,
  }
}

function statsFromProgress(progress: MemberGameProgress | null): BlackjackStats {
  if (!progress) return initialStats()

  return {
    plays: progress.plays,
    wins: progress.wins,
    losses: progress.losses,
    pushes: Math.max(0, progress.plays - progress.wins - progress.losses),
    totalStake: 0,
    totalDelta: progress.lastDelta,
    blackjacks: 0,
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
    totalDelta: stats.totalDelta + round.delta,
    blackjacks: stats.blackjacks + blackjacks,
  }
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

function actionLabel(action: BlackjackAction, language: Language) {
  return actionLabels[action][language]
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
  const storageKey = `taihu-blackjack-table-${entry.slug}`
  const latestRound = initialGameRounds[0] ?? null
  const [tableSession, setTableSession] = useState<MemberTableSession | null>(initialTableSession)
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance)
  const [bankroll, setBankroll] = useState(initialTableSession?.chipBalance ?? 0)
  const [buyInAmount, setBuyInAmount] = useState(100)
  const [stake, setStake] = useState(entry.defaultBet || 50)
  const [blackjackRound, setBlackjackRound] = useState<BlackjackRoundView | null>(initialBlackjackRound ?? null)
  const [lastRound, setLastRound] = useState<MemberGameRound | null>(latestRound)
  const [stats, setStats] = useState<BlackjackStats>(() => statsFromProgress(initialProgress))
  const [isOpeningSession, setIsOpeningSession] = useState(false)
  const [isCashingOut, setIsCashingOut] = useState(false)
  const [isActing, setIsActing] = useState(false)
  const [message, setMessage] = useState(
    initialBlackjackRound
      ? isChinese ? "已恢复服务端 21 点回合。" : "Restored the server blackjack round."
      : latestRound?.resultSummary ?? (isChinese ? "买入后由服务端发牌。" : "Buy in, then let the server deal."),
  )
  const activeRound = blackjackRound?.status === "active" ? blackjackRound : null
  const phaseText = useMemo(() => {
    if (!blackjackRound) return isChinese ? "等待开局" : "Waiting"
    if (blackjackRound.phase === "insurance") return isChinese ? "保险决策" : "Insurance"
    if (blackjackRound.phase === "player_turn") return isChinese ? "玩家回合" : "Player turn"
    if (blackjackRound.phase === "settled") return isChinese ? "已结算" : "Settled"
    if (blackjackRound.phase === "voided") return isChinese ? "已作废" : "Voided"
    return isChinese ? "庄家回合" : "Dealer turn"
  }, [blackjackRound, isChinese])

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)
    if (!saved) return

    try {
      const parsed = JSON.parse(saved) as { stake?: unknown }
      if (typeof parsed.stake === "number" && Number.isFinite(parsed.stake) && parsed.stake > 0) {
        setStake(parsed.stake)
      }
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [storageKey])

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ stake }))
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
    setMessage(round.summary)
  }

  async function handleBuyIn() {
    if (isOpeningSession) return
    setIsOpeningSession(true)
    setMessage(isChinese ? "正在买入桌台筹码……" : "Buying in to the table…")

    try {
      const result = await openClientTableSession(entry.slug, buyInAmount, `blackjack-buy-in-${Date.now()}`)
      setTableSession(result.tableSession)
      setBankroll(result.tableSession.chipBalance)
      setWalletBalance(result.walletBalance ?? Math.max(0, walletBalance - buyInAmount))
      setBlackjackRound(null)
      setMessage(isChinese ? "买入完成。现在可以请求服务端发牌。" : "Buy-in complete. Ask the server to deal.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "买入失败。" : "Buy-in failed.")
    } finally {
      setIsOpeningSession(false)
    }
  }

  async function handleCashOut() {
    if (!tableSession || isCashingOut || activeRound) return
    setIsCashingOut(true)
    setMessage(isChinese ? "正在离桌结算……" : "Cashing out…")

    try {
      const result = await cashOutClientTableSession(tableSession.id, `blackjack-cash-out-${Date.now()}`)
      setTableSession(result.tableSession)
      setWalletBalance(result.walletBalance ?? walletBalance + tableSession.chipBalance)
      setBankroll(result.tableSession.chipBalance)
      setMessage(isChinese ? "已离桌，桌台筹码回到主钱包。" : "Cashed out to the main wallet.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "离桌失败。" : "Cash-out failed.")
    } finally {
      setIsCashingOut(false)
    }
  }

  async function handleDeal() {
    if (!tableSession || activeRound || isActing) return
    setIsActing(true)
    setMessage(isChinese ? "服务端正在发牌……" : "Server is dealing…")

    try {
      const result = await recordClientGameRound({
        gameSlug: entry.slug,
        tableSessionId: tableSession.id,
        idempotencyKey: `blackjack-round-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        betSnapshot: { stake },
      })

      if (result.blackjackRound) {
        setBlackjackRound(result.blackjackRound)
        setMessage(isChinese ? "服务端已发牌，请按可用动作继续。" : "Server dealt the hand. Continue with the available action.")
      }

      if (result.round) {
        applyFinalRound(result.round)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "发牌失败。" : "Deal failed.")
    } finally {
      setIsActing(false)
    }
  }

  async function handleAction(action: BlackjackAction) {
    if (!activeRound || isActing) return
    setIsActing(true)
    setMessage(isChinese ? "正在提交动作给服务端……" : "Submitting action to the server…")

    try {
      const result = await recordClientBlackjackAction(activeRound.roundId, {
        commandId: newCommandId(action),
        expectedVersion: activeRound.version,
        action,
        handId: activeRound.currentHandId,
      })

      if (result.blackjackRound) {
        setBlackjackRound(result.blackjackRound)
      }

      if (result.round) {
        applyFinalRound(result.round)
      } else {
        setMessage(isChinese ? "动作已确认，等待下一步。" : "Action confirmed. Waiting for the next move.")
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "动作失败。" : "Action failed.")
    } finally {
      setIsActing(false)
    }
  }

  return (
    <main
      className="min-h-screen bg-[#120907] px-4 py-8 text-[#fff4d8] sm:px-8"
      data-round-id={blackjackRound?.round?.roundId ?? blackjackRound?.roundId ?? lastRound?.id ?? ""}
    >
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-[2rem] border border-[#f6c66d]/30 bg-[#1d0f0b]/95 p-6 shadow-2xl shadow-black/40">
          <p className="text-xs font-black uppercase tracking-[0.4em] text-[#f6c66d]">
            {isChinese ? "服务端权威 21 点" : "Server-authoritative blackjack"}
          </p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black text-white sm:text-5xl">
                {isChinese ? "21 点实桌" : "Blackjack table"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#f8dfad]">
                {isChinese
                  ? "客户端只提交下注和动作。发牌、暗牌、可用动作、结算与历史都由服务端状态机返回。"
                  : "The client submits only stake and actions. Cards, hole-card visibility, allowed moves, settlement, and history all come from the server state machine."}
              </p>
            </div>
            <div className="rounded-2xl border border-[#f6c66d]/25 bg-black/25 px-4 py-3 text-sm">
              <p className="text-[#f8dfad]">{isChinese ? "阶段" : "Phase"}</p>
              <p className="text-2xl font-black text-[#f6c66d]">{phaseText}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Metric label={isChinese ? "主钱包" : "Main wallet"} value={formatMoney(walletBalance)} />
          <Metric label={isChinese ? "桌台筹码" : "Table chips"} value={formatMoney(bankroll)} />
          <Metric label={isChinese ? "本轮盈亏" : "Round delta"} value={`${blackjackRound?.delta && blackjackRound.delta > 0 ? "+" : ""}${formatMoney(blackjackRound?.delta ?? lastRound?.delta ?? 0)}`} />
          <Metric label={isChinese ? "服务端版本" : "Server version"} value={String(blackjackRound?.version ?? "—")} />
        </div>

        {!tableSession || tableSession.status !== "active" ? (
          <section className="rounded-[2rem] border border-[#f6c66d]/25 bg-[#21120d] p-6">
            <h2 className="text-2xl font-black">{isChinese ? "买入桌台" : "Buy in"}</h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="text-sm font-bold text-[#f8dfad]">
                {isChinese ? "买入金额" : "Buy-in amount"}
                <input
                  className="mt-2 w-full rounded-xl border border-[#f6c66d]/30 bg-black/30 px-4 py-3 text-white"
                  type="number"
                  min={1}
                  value={buyInAmount}
                  onChange={(event) => setBuyInAmount(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>
              <Button type="button" onClick={handleBuyIn} disabled={isOpeningSession}>
                {isOpeningSession ? (isChinese ? "买入中…" : "Buying in…") : (isChinese ? "买入" : "Buy in")}
              </Button>
            </div>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-[2rem] border border-[#f6c66d]/25 bg-[#21120d] p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-black">{isChinese ? "服务端牌面" : "Server cards"}</h2>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={handleDeal} disabled={Boolean(activeRound) || isActing || bankroll < stake}>
                    {isChinese ? "发牌" : "Deal"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCashOut} disabled={Boolean(activeRound) || isCashingOut}>
                    {isChinese ? "离桌" : "Cash out"}
                  </Button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <HandPanel
                  title={isChinese ? "庄家" : "Dealer"}
                  cards={blackjackRound?.dealer.cards ?? []}
                  total={blackjackRound?.dealer.total ?? null}
                  hidden={blackjackRound?.dealer.holeCardHidden}
                />
                <div className="space-y-4">
                  {(blackjackRound?.playerHands ?? []).length > 0 ? blackjackRound?.playerHands.map((hand, index) => (
                    <HandPanel
                      key={hand.handId}
                      title={`${isChinese ? "玩家手牌" : "Player hand"} ${index + 1}${hand.handId === blackjackRound.currentHandId ? (isChinese ? " · 当前" : " · active") : ""}`}
                      cards={hand.cards}
                      total={hand.total}
                      note={`${isChinese ? "下注" : "Bet"} ${formatMoney(hand.bet)} · ${hand.status}${hand.delta !== null ? ` · ${hand.delta >= 0 ? "+" : ""}${formatMoney(hand.delta)}` : ""}`}
                    />
                  )) : (
                    <div className="rounded-2xl border border-dashed border-[#f6c66d]/25 bg-black/20 p-6 text-sm text-[#f8dfad]">
                      {isChinese ? "等待服务端发牌。" : "Waiting for the server deal."}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {(activeRound?.allowedActions ?? []).map((action) => (
                  <Button
                    key={action}
                    type="button"
                    variant={action === "stand" || action === "skip_insurance" ? "outline" : "default"}
                    onClick={() => handleAction(action)}
                    disabled={isActing}
                  >
                    {actionLabel(action, language)}
                  </Button>
                ))}
              </div>
            </div>

            <aside className="rounded-[2rem] border border-[#f6c66d]/25 bg-[#21120d] p-6">
              <h2 className="text-2xl font-black">{isChinese ? "下注与统计" : "Stake and stats"}</h2>
              <label className="mt-4 block text-sm font-bold text-[#f8dfad]">
                {isChinese ? "主注" : "Main stake"}
                <input
                  className="mt-2 w-full rounded-xl border border-[#f6c66d]/30 bg-black/30 px-4 py-3 text-white"
                  type="number"
                  min={1}
                  disabled={Boolean(activeRound)}
                  value={stake}
                  onChange={(event) => setStake(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <MiniMetric label={isChinese ? "局数" : "Hands"} value={String(stats.plays)} />
                <MiniMetric label={isChinese ? "胜" : "Wins"} value={String(stats.wins)} />
                <MiniMetric label={isChinese ? "负" : "Losses"} value={String(stats.losses)} />
                <MiniMetric label={isChinese ? "黑杰克" : "Blackjacks"} value={String(stats.blackjacks)} />
              </div>

              <div className="mt-6 rounded-2xl border border-[#f6c66d]/20 bg-black/25 p-4 text-sm leading-6 text-[#f8dfad]">
                {message}
              </div>
            </aside>
          </section>
        )}
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string, value: string }) {
  return (
    <div className="rounded-2xl border border-[#f6c66d]/25 bg-[#21120d] p-4">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f6c66d]/80">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string, value: string }) {
  return (
    <div className="rounded-xl border border-[#f6c66d]/20 bg-black/20 p-3">
      <p className="text-xs text-[#f8dfad]">{label}</p>
      <p className="text-xl font-black text-white">{value}</p>
    </div>
  )
}

function HandPanel({
  title,
  cards,
  total,
  hidden = false,
  note,
}: {
  title: string
  cards: BlackjackVisibleCard[]
  total: number | null
  hidden?: boolean
  note?: string
}) {
  return (
    <div className="rounded-2xl border border-[#f6c66d]/20 bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-black text-white">{title}</h3>
        <span className="rounded-full bg-[#f6c66d]/15 px-3 py-1 text-sm font-black text-[#f6c66d]">
          {total === null ? "?" : total}
        </span>
      </div>
      {note ? <p className="mt-1 text-xs text-[#f8dfad]/80">{note}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {cards.map((card, index) => (
          <div
            key={`${card.rank}-${card.suit}-${index}`}
            data-testid={`blackjack-card-${rankLabel(card.rank)}-${card.suit}`}
            className="flex h-24 w-16 flex-col items-center justify-center rounded-xl border border-[#f6c66d]/30 bg-[#fff4d8] text-lg font-black text-[#2b120c] shadow-lg"
          >
            <span>{rankLabel(card.rank)}</span>
            <span className={card.suit === "hearts" || card.suit === "diamonds" ? "text-red-700" : "text-black"}>
              {suitLabel(card.suit)}
            </span>
          </div>
        ))}
        {hidden ? (
          <div data-testid="blackjack-card-hidden" className="flex h-24 w-16 items-center justify-center rounded-xl border border-[#f6c66d]/30 bg-[#34170f] text-2xl font-black text-[#f6c66d] shadow-lg">
            ?
          </div>
        ) : null}
      </div>
    </div>
  )
}
