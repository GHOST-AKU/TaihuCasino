"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, BookOpen, RotateCcw, Settings, Trash2 } from "lucide-react"

import { useLanguage } from "@/hooks/use-language"
import { type Language } from "@/lib/home-content"
import { type CasinoTableEntry } from "@/lib/game-catalog"
import { type MemberGameProgress, type MemberTableSession } from "@/lib/member-data"
import { cashOutClientTableSession, openClientTableSession } from "@/lib/table-session-client"
import { cn } from "@/lib/utils"

type DiceBetKey = "big" | "small" | "odd" | "even" | "triple"
type DiceBetLedger = Record<DiceBetKey, number>

interface DiceOutcome {
  dice: [number, number, number]
  sum: number
  triple: boolean
}

interface DiceHistory extends DiceOutcome {
  id: string
  round: number
  delta: number
  totalStake: number
  bets: DiceBetLedger
  detail: string
}

interface DiceStats {
  rounds: number
  totalStake: number
  totalDelta: number
  lastDelta: number
  history: DiceHistory[]
}

const emptyDiceBets: DiceBetLedger = {
  big: 0,
  small: 0,
  odd: 0,
  even: 0,
  triple: 0,
}

const diceBets = [
  {
    key: "big",
    zh: "大",
    en: "BIG",
    odds: "1:1",
    payout: 1,
    probability: 105 / 216,
    tone: "big",
    wins: ({ sum }: DiceOutcome) => sum >= 11 && sum <= 17,
  },
  {
    key: "small",
    zh: "小",
    en: "SMALL",
    odds: "1:1",
    payout: 1,
    probability: 105 / 216,
    tone: "small",
    wins: ({ sum }: DiceOutcome) => sum >= 4 && sum <= 10,
  },
  {
    key: "odd",
    zh: "单",
    en: "ODD",
    odds: "1:1",
    payout: 1,
    probability: 108 / 216,
    tone: "odd",
    wins: ({ sum }: DiceOutcome) => sum % 2 === 1,
  },
  {
    key: "even",
    zh: "双",
    en: "EVEN",
    odds: "1:1",
    payout: 1,
    probability: 108 / 216,
    tone: "even",
    wins: ({ sum }: DiceOutcome) => sum % 2 === 0,
  },
  {
    key: "triple",
    zh: "豹子",
    en: "TRIPLE",
    odds: "24:1",
    payout: 24,
    probability: 6 / 216,
    tone: "triple",
    wins: ({ triple }: DiceOutcome) => triple,
  },
] satisfies Array<{
  key: DiceBetKey
  zh: string
  en: string
  odds: string
  payout: number
  probability: number
  tone: string
  wins: (outcome: DiceOutcome) => boolean
}>

function cloneEmptyDiceBets(): DiceBetLedger {
  return { ...emptyDiceBets }
}

function clampInt(value: unknown, fallback: number) {
  const parsed = Math.floor(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseChips(value: string, fallback: number[]) {
  const parsed = Array.from(
    new Set(
      value
        .split(",")
        .map((item) => clampInt(item.trim(), 0))
        .filter((item) => item > 0),
    ),
  )
    .sort((a, b) => a - b)
    .slice(0, 8)

  return parsed.length > 0 ? parsed : fallback
}

function rollDie() {
  return 1 + Math.floor(Math.random() * 6)
}

function rollDice(): [number, number, number] {
  return [rollDie(), rollDie(), rollDie()]
}

function formatMoney(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  })
}

function formatDelta(value: number) {
  if (value === 0) {
    return "+0"
  }

  return `${value > 0 ? "+" : "-"}${formatMoney(Math.abs(value))}`
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`
}

function totalDiceStake(bets: DiceBetLedger) {
  return Object.values(bets).reduce((sum, amount) => sum + amount, 0)
}

function calculateDicePreview(bets: DiceBetLedger) {
  const totalStake = totalDiceStake(bets)
  const expectedValue = diceBets.reduce((sum, bet) => {
    const amount = bets[bet.key]
    return sum + amount * (bet.probability * bet.payout - (1 - bet.probability))
  }, 0)

  return {
    count: Object.values(bets).filter((amount) => amount > 0).length,
    expectedValue,
    totalStake,
  }
}

function resolveDiceRound(bets: DiceBetLedger, dice: [number, number, number], language: Language) {
  const outcome: DiceOutcome = {
    dice,
    sum: dice.reduce((sum, value) => sum + value, 0),
    triple: dice[0] === dice[1] && dice[1] === dice[2],
  }
  const details: string[] = []
  let delta = 0

  for (const bet of diceBets) {
    const amount = bets[bet.key]

    if (amount <= 0) {
      continue
    }

    if (bet.wins(outcome)) {
      const profit = amount * bet.payout
      delta += profit
      details.push(
        language === "zh"
          ? `${bet.zh} 中 ${formatDelta(profit)}`
          : `${bet.en} hit ${formatDelta(profit)}`,
      )
    } else {
      delta -= amount
      details.push(
        language === "zh"
          ? `${bet.zh} 未中 ${formatDelta(-amount)}`
          : `${bet.en} missed ${formatDelta(-amount)}`,
      )
    }
  }

  return {
    ...outcome,
    delta,
    detail: details.join(language === "zh" ? "；" : "; "),
  }
}

async function persistDiceProgress(
  entry: CasinoTableEntry,
  record: DiceHistory,
  bankroll: number,
  tableSessionId?: string,
) {
  const response = await fetch("/api/member/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameSlug: entry.slug,
      outcome: record.delta > 0 ? "win" : record.delta < 0 ? "loss" : "push",
      delta: record.delta,
      bankroll,
      summary: `${record.dice.join("+")}=${record.sum}; ${formatDelta(record.delta)}`,
      idempotencyKey: record.id,
      tableSessionId,
      totalStake: record.totalStake,
      betSnapshot: {
        bets: record.bets,
        totalStake: record.totalStake,
      },
      resultSnapshot: {
        dice: record.dice,
        sum: record.sum,
        triple: record.triple,
      },
    }),
  }).catch(() => null)

  if (!response?.ok) {
    return null
  }

  const payload = (await response.json().catch(() => null)) as { progress?: { bankroll?: unknown } } | null
  return typeof payload?.progress?.bankroll === "number" ? payload.progress.bankroll : null
}

export function DiceTablePage({
  entry,
  defaultLanguage,
  initialWalletBalance,
  initialProgress,
  initialTableSession,
}: {
  entry: CasinoTableEntry
  defaultLanguage: Language
  initialWalletBalance: number
  initialProgress: MemberGameProgress | null
  initialTableSession: MemberTableSession | null
}) {
  const [language] = useLanguage(defaultLanguage)
  const isChinese = language === "zh"
  const defaultChips = [10, 25, 50, 100, 250]
  const initialBankroll = initialTableSession?.chipBalance ?? 0
  const [bankroll, setBankroll] = useState(initialBankroll)
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance)
  const [tableSession, setTableSession] = useState<MemberTableSession | null>(initialTableSession)
  const [buyInAmount, setBuyInAmount] = useState(100)
  const [isOpeningSession, setIsOpeningSession] = useState(false)
  const [isCashingOut, setIsCashingOut] = useState(false)
  const [stake, setStake] = useState(50)
  const [chips, setChips] = useState(defaultChips)
  const [initialBankrollInput, setInitialBankrollInput] = useState(String(initialBankroll))
  const [initialChipsInput, setInitialChipsInput] = useState(defaultChips.join(","))
  const [bets, setBets] = useState<DiceBetLedger>(() => cloneEmptyDiceBets())
  const [dice, setDice] = useState<[number, number, number]>([1, 1, 1])
  const [lastSum, setLastSum] = useState(3)
  const [headline, setHeadline] = useState(isChinese ? "等待下注" : "Waiting for bets")
  const [subText, setSubText] = useState(
    isChinese
      ? "可同时下多个注，点击下注区即可按当前金额追加。"
      : "Click a betting card to add the current stake. Multiple bets can resolve together.",
  )
  const [rolling, setRolling] = useState(false)
  const [stats, setStats] = useState<DiceStats>(() => ({
    rounds: initialProgress?.plays ?? 0,
    totalStake: 0,
    totalDelta: initialProgress?.lastDelta ?? 0,
    lastDelta: initialProgress?.lastDelta ?? 0,
    history: [],
  }))
  const [showRules, setShowRules] = useState(false)
  const storageKey = `taihu-dice-table-${entry.slug}`
  const preview = useMemo(() => calculateDicePreview(bets), [bets])
  const roi = stats.totalStake > 0 ? (stats.totalDelta / stats.totalStake) * 100 : 0

  useEffect(() => {
    if (!initialTableSession) {
      window.localStorage.removeItem(storageKey)
      setWalletBalance(initialWalletBalance)
      setTableSession(null)
      setBankroll(0)
      setInitialBankrollInput("0")
      setBets(cloneEmptyDiceBets())
      setRolling(false)

      if (initialProgress) {
        setStats((current) => ({
          ...current,
          rounds: initialProgress.plays,
          totalDelta: initialProgress.lastDelta,
          lastDelta: initialProgress.lastDelta,
        }))
      }

      return
    }

    const saved = window.localStorage.getItem(storageKey)

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          bankroll?: number
          stake?: number
          chips?: number[]
          stats?: DiceStats
          dice?: [number, number, number]
          lastSum?: number
        }

        if (typeof parsed.stake === "number") {
          setStake(parsed.stake)
        }

        if (Array.isArray(parsed.chips) && parsed.chips.every((chip) => typeof chip === "number")) {
          setChips(parsed.chips)
          setInitialChipsInput(parsed.chips.join(","))
        }

        if (parsed.stats) {
          setStats(parsed.stats)
        }

        if (Array.isArray(parsed.dice) && parsed.dice.length === 3) {
          setDice(parsed.dice)
        }

        if (typeof parsed.lastSum === "number") {
          setLastSum(parsed.lastSum)
        }
      } catch {
        window.localStorage.removeItem(storageKey)
      }
    }

    const syncedBankroll = initialTableSession.chipBalance
    setWalletBalance(initialWalletBalance)
    setTableSession(initialTableSession)
    setBankroll(syncedBankroll)
    setInitialBankrollInput(String(syncedBankroll))

    if (initialProgress) {
      setStats((current) => ({
        ...current,
        rounds: initialProgress.plays,
        totalDelta: initialProgress.lastDelta,
        lastDelta: initialProgress.lastDelta,
      }))
    }
  }, [storageKey, initialProgress, initialWalletBalance, initialTableSession])

  function persistLocal(nextBankroll: number, nextStats: DiceStats, nextDice: [number, number, number], nextSum: number) {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        bankroll: nextBankroll,
        stake,
        chips,
        stats: nextStats,
        dice: nextDice,
        lastSum: nextSum,
      }),
    )
  }

  async function openSession() {
    const amount = Math.min(1000000, Math.max(1, Math.round(Number(buyInAmount) * 100) / 100))

    if (amount > walletBalance) {
      setHeadline(isChinese ? "钱包余额不足" : "Insufficient wallet balance")
      setSubText(isChinese ? "无法买入这笔筹码。" : "Wallet balance is not enough for this buy-in.")
      return
    }

    setIsOpeningSession(true)
    setHeadline(isChinese ? "买入中..." : "Buying in...")
    setSubText(isChinese ? "正在从钱包买入桌台筹码。" : "Buying chips from your wallet.")

    try {
      const result = await openClientTableSession(entry.slug, amount, "dice-buy-in")

      setTableSession(result.tableSession)
      setBankroll(result.tableSession.chipBalance)
      setInitialBankrollInput(String(result.tableSession.chipBalance))
      setWalletBalance(result.walletBalance ?? walletBalance - amount)
      setBets(cloneEmptyDiceBets())
      window.localStorage.removeItem(storageKey)
      setHeadline(isChinese ? "买入成功" : "Buy-in complete")
      setSubText(isChinese ? "桌台筹码已准备好。" : "Table chips are ready.")
    } catch (error) {
      setHeadline(isChinese ? "买入失败" : "Buy-in failed")
      setSubText(error instanceof Error ? error.message : isChinese ? "请稍后重试。" : "Please try again.")
    } finally {
      setIsOpeningSession(false)
    }
  }

  async function cashOutSession() {
    if (!tableSession || isCashingOut || rolling) {
      return
    }

    setIsCashingOut(true)
    setHeadline(isChinese ? "离桌中..." : "Cashing out...")
    setSubText(isChinese ? "正在带走筹码并结算回钱包。" : "Cashing out table chips to your wallet.")

    try {
      const result = await cashOutClientTableSession(tableSession.id, "dice-cash-out")

      setTableSession(null)
      setBankroll(0)
      setInitialBankrollInput("0")
      setWalletBalance(result.walletBalance ?? walletBalance + tableSession.chipBalance)
      setBets(cloneEmptyDiceBets())
      window.localStorage.removeItem(storageKey)
      setHeadline(isChinese ? "筹码已带走" : "Chips cashed out")
      setSubText(isChinese ? "余额已回到钱包。" : "Balance returned to wallet.")
    } catch (error) {
      setHeadline(isChinese ? "离桌失败" : "Cash-out failed")
      setSubText(error instanceof Error ? error.message : isChinese ? "请稍后重试。" : "Please try again.")
    } finally {
      setIsCashingOut(false)
    }
  }

  function addBet(key: DiceBetKey) {
    if (!tableSession) {
      setHeadline(isChinese ? "请先买入筹码" : "Buy in first")
      setSubText(isChinese ? "先从钱包买入桌台筹码再入桌。" : "Buy in from your wallet before playing this table.")
      return
    }

    const amount = clampInt(stake, 1)

    if (preview.totalStake + amount > bankroll) {
      setHeadline(isChinese ? "余额不足" : "Insufficient bankroll")
      setSubText(
        isChinese
          ? `当前总下注 ${formatMoney(preview.totalStake)}，不能再追加 ${formatMoney(amount)}。`
          : `Current total stake is ${formatMoney(preview.totalStake)}; cannot add ${formatMoney(amount)}.`,
      )
      return
    }

    setBets((current) => ({ ...current, [key]: current[key] + amount }))
  }

  function setBetAmount(key: DiceBetKey, amount: number) {
    setBets((current) => ({ ...current, [key]: Math.max(0, amount) }))
  }

  function clearBets() {
    setBets(cloneEmptyDiceBets())
    setHeadline(isChinese ? "已清空下注" : "Bets cleared")
    setSubText(isChinese ? "余额与历史记录保留。" : "Bankroll and history were kept.")
  }

  function applyInitialSettings() {
    const nextBankroll = tableSession?.chipBalance ?? 0
    const nextChips = parseChips(initialChipsInput, defaultChips)

    setBankroll(nextBankroll)
    setChips(nextChips)
    setStake(nextChips[0])
    setBets(cloneEmptyDiceBets())
    setDice([1, 1, 1])
    setLastSum(3)
    setStats({ rounds: 0, totalStake: 0, totalDelta: 0, lastDelta: 0, history: [] })
    window.localStorage.removeItem(storageKey)
    setHeadline(isChinese ? "初始设置已应用" : "Initial settings applied")
    setSubText(isChinese ? "余额、筹码和历史已刷新。" : "Bankroll, chips and history were refreshed.")
  }

  function resetTable() {
    const nextBankroll = tableSession?.chipBalance ?? 0

    setBankroll(nextBankroll)
    setInitialBankrollInput(String(nextBankroll))
    setChips(defaultChips)
    setInitialChipsInput(defaultChips.join(","))
    setStake(50)
    setBets(cloneEmptyDiceBets())
    setDice([1, 1, 1])
    setLastSum(3)
    setStats({ rounds: 0, totalStake: 0, totalDelta: 0, lastDelta: 0, history: [] })
    window.localStorage.removeItem(storageKey)
    setHeadline(isChinese ? "已重置局面" : "Table reset")
    setSubText(isChinese ? "余额、下注和历史都已恢复到初始状态。" : "Bankroll, bets and history were reset.")
  }

  function roll() {
    if (rolling) {
      return
    }

    if (!tableSession) {
      setHeadline(isChinese ? "请先买入筹码" : "Buy in first")
      setSubText(isChinese ? "先从钱包买入桌台筹码再入桌。" : "Buy in from your wallet before playing this table.")
      return
    }
    const activeTableSession = tableSession

    if (preview.totalStake <= 0) {
      setHeadline(isChinese ? "请先下注" : "Place a bet first")
      setSubText(isChinese ? "至少选择一个下注项后再掷骰。" : "Choose at least one bet before rolling.")
      return
    }

    if (bankroll < preview.totalStake) {
      setHeadline(isChinese ? "余额不足" : "Insufficient bankroll")
      setSubText(
        isChinese
          ? `当前总下注 ${formatMoney(preview.totalStake)}，余额只有 ${formatMoney(bankroll)}。`
          : `Total stake is ${formatMoney(preview.totalStake)}, bankroll is ${formatMoney(bankroll)}.`,
      )
      return
    }

    setRolling(true)
    setHeadline(isChinese ? "骰子摇动中..." : "Rolling...")
    setSubText(isChinese ? "动画为简化版进度条和实时随机点数预览。" : "Preview dice are shuffling before settlement.")

    const previewTimer = window.setInterval(() => setDice(rollDice()), 85)
    const actualDice = rollDice()

    window.setTimeout(() => {
      window.clearInterval(previewTimer)
      const result = resolveDiceRound(bets, actualDice, language)
      const nextBankroll = bankroll + result.delta
      const nextRound = stats.rounds + 1
      const record: DiceHistory = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        round: nextRound,
        dice: result.dice,
        sum: result.sum,
        triple: result.triple,
        delta: result.delta,
        totalStake: preview.totalStake,
        bets,
        detail: result.detail,
      }
      const nextStats: DiceStats = {
        rounds: nextRound,
        totalStake: stats.totalStake + preview.totalStake,
        totalDelta: stats.totalDelta + result.delta,
        lastDelta: result.delta,
        history: [record, ...stats.history].slice(0, 20),
      }

      setDice(actualDice)
      setLastSum(result.sum)
      setBankroll(nextBankroll)
      setTableSession({ ...activeTableSession, chipBalance: nextBankroll })
      setStats(nextStats)
      setRolling(false)
      setHeadline(result.triple ? (isChinese ? "豹子出现！" : "Triple!") : isChinese ? `和值 ${result.sum}` : `Total ${result.sum}`)
      setSubText(`${result.dice.join(" + ")} = ${result.sum}，${result.detail}。`)
      persistLocal(nextBankroll, nextStats, actualDice, result.sum)
      void persistDiceProgress(entry, record, nextBankroll, activeTableSession.id).then((serverBankroll) => {
        if (typeof serverBankroll === "number") {
          setBankroll(serverBankroll)
          setTableSession((current) => current ? { ...current, chipBalance: serverBankroll } : current)
          persistLocal(serverBankroll, nextStats, actualDice, result.sum)
        }
      })
    }, 1400)
  }

  return (
    <main className="game-table-shell lobby-shell min-h-screen overflow-hidden bg-background text-foreground">
      <div className="mx-auto grid max-w-[1360px] gap-3 px-4 py-4 lg:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/?lang=${language}`}
              className="grid size-10 place-items-center rounded-lg border border-[#d0b06e]/35 bg-black/20 text-[#f8ecd2] transition hover:bg-[#d0b06e]/15"
              aria-label={isChinese ? "返回大厅" : "Back to lobby"}
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d0b06e]">
                {isChinese ? "三骰子桌" : "Three dice table"}
              </p>
              <h1 className="text-2xl font-black tracking-normal text-[#fff4d8] md:text-4xl">
                {isChinese ? entry.titleZh : entry.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRules(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#214a35]"
            >
              <BookOpen className="size-4" />
              {isChinese ? "玩法说明" : "Rules"}
            </button>
            <button
              type="button"
              onClick={clearBets}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#214a35]"
            >
              <Trash2 className="size-4" />
              {isChinese ? "清空下注" : "Clear"}
            </button>
            <button
              type="button"
              onClick={resetTable}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#214a35]"
            >
              <RotateCcw className="size-4" />
              {isChinese ? "重置局面" : "Reset"}
            </button>
            <Link
              href="/member/settings"
              className="grid size-10 place-items-center rounded-lg border border-[#d0b06e]/35 bg-black/20 text-[#f8ecd2] transition hover:bg-[#d0b06e]/15"
              aria-label={isChinese ? "设置" : "Settings"}
            >
              <Settings className="size-4" />
            </Link>
          </div>
        </header>

        {!tableSession ? (
          <section className="rounded-lg border border-[#d0b06e]/35 bg-black/25 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
                  {isChinese ? "买入筹码" : "Table buy-in"}
                </p>
                <h2 className="mt-2 text-2xl font-black text-[#fff4d8]">
                  {isChinese ? "先从钱包买入本桌筹码" : "Buy chips before joining this table"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#cbbd91]">
                  {isChinese
                    ? "骰子下注只使用桌台筹码，离桌时再把剩余筹码带回钱包。"
                    : "Dice bets use table chips, then remaining chips return to your wallet when you cash out."}
                </p>
                <p className="mt-3 text-sm font-black text-[#f4d18a]">
                  {isChinese ? "钱包余额" : "Wallet"} {formatMoney(walletBalance)}
                </p>
              </div>

              <form
                action="/api/member/table-sessions"
                method="post"
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault()
                  void openSession()
                }}
              >
                <input type="hidden" name="gameSlug" value={entry.slug} />
                <div className="space-y-2">
                  <label htmlFor="diceBuyInAmount" className="text-sm font-black text-[#fff4d8]">
                    {isChinese ? "买入金额" : "Buy-in amount"}
                  </label>
                  <input
                    id="diceBuyInAmount"
                    name="buyInAmount"
                    type="number"
                    min={1}
                    max={1000000}
                    step={1}
                    value={buyInAmount}
                    onChange={(event) => setBuyInAmount(Number(event.target.value))}
                    className="h-11 w-44 rounded-lg border border-[#d0b06e]/35 bg-black/30 px-3 text-base font-black text-[#fff4d8] outline-none transition focus:border-[#f0cf83]"
                  />
                </div>
                <div className="flex gap-2">
                  {[100, 250, 500].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setBuyInAmount(amount)}
                      className="h-11 rounded-lg border border-[#d0b06e]/30 bg-black/20 px-3 text-sm font-black text-[#fff4d8] transition hover:bg-[#d0b06e]/15"
                    >
                      {formatMoney(amount)}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={isOpeningSession}
                  className="h-11 rounded-lg bg-[#f0cf83] px-5 text-sm font-black text-[#1c160c] transition hover:bg-[#ffd98c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isOpeningSession ? (isChinese ? "买入中..." : "Buying in...") : isChinese ? "买入并入桌" : "Buy in"}
                </button>
              </form>
            </div>
          </section>
        ) : null}

        <section className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-lg border border-[#d0b06e]/30 bg-white/[0.035] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
                  {isChinese ? "资金与掷骰" : "Bankroll & Roll"}
                </p>
                <p className="mt-3 text-sm text-[#cbbd91]">{isChinese ? "桌台筹码" : "Table chips"}</p>
                <p className="text-5xl font-black leading-none text-[#f4d18a] md:text-6xl">
                  {formatMoney(bankroll)}
                </p>
                <p className="mt-2 text-xs font-bold text-[#cbbd91]">
                  {isChinese ? "钱包" : "Wallet"} {formatMoney(walletBalance)}
                </p>
              </div>
              {tableSession ? (
                <button
                  type="button"
                  onClick={cashOutSession}
                  disabled={rolling || isCashingOut}
                  className="inline-flex min-h-12 items-center rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#214a35] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isCashingOut ? (isChinese ? "离桌中..." : "Cashing out...") : isChinese ? "带走筹码" : "Cash out"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={roll}
                disabled={rolling || !tableSession || preview.totalStake <= 0 || bankroll < preview.totalStake}
                className="inline-flex min-h-12 items-center rounded-lg border border-[#d0b06e]/50 bg-gradient-to-b from-[#f0cf83] to-[#c69d55] px-5 text-base font-black text-[#34240a] shadow-[0_14px_28px_rgba(0,0,0,0.26)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {rolling ? (isChinese ? "掷骰中" : "Rolling") : isChinese ? "掷骰结算" : "Roll"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniStat label={isChinese ? "当前下注额" : "Stake"} value={formatMoney(stake)} />
              <MiniStat label={isChinese ? "本局总下注" : "Total bet"} value={formatMoney(preview.totalStake)} />
              <MiniStat label={isChinese ? "已选注项" : "Bet count"} value={String(preview.count)} />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-xl font-black text-[#fff4d8]">{headline}</p>
                <p className="mt-2 text-sm leading-6 text-[#cbbd91]">{subText}</p>
              </div>
              <div className="text-right text-sm text-[#cbbd91]">{isChinese ? "动画区 / Dice Stage" : "Dice stage"}</div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full border border-white/10 bg-black/25">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r from-transparent via-[#f0cf83] to-transparent transition-all duration-[1400ms]",
                  rolling ? "w-full" : "w-0",
                )}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-[#cbbd91]">
              {isChinese
                ? "规则提示：大 = 11-17，小 = 4-10，单/双按和值奇偶，豹子 = 三颗同点。"
                : "Rules: Big = 11-17, Small = 4-10, Odd/Even by total, Triple = three equal dice."}
            </p>
          </div>

          <div className="rounded-lg border border-[#d0b06e]/30 bg-white/[0.035] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
              {isChinese ? "掷骰结果" : "Result"}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {dice.map((value, index) => (
                <DieFace
                  key={`${index}-${value}`}
                  value={value}
                  label={`DIE ${index + 1}`}
                  rolling={rolling}
                  index={index}
                />
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniStat label={isChinese ? "和值" : "Total"} value={String(lastSum)} />
              <MiniStat
                label={isChinese ? "本轮盈亏" : "Round delta"}
                value={formatDelta(stats.lastDelta)}
                tone={stats.lastDelta > 0 ? "good" : stats.lastDelta < 0 ? "bad" : "neutral"}
              />
              <MiniStat label={isChinese ? "结算状态" : "Status"} value={rolling ? (isChinese ? "掷骰中" : "Rolling") : stats.rounds > 0 ? (isChinese ? "已结算" : "Settled") : (isChinese ? "待掷骰" : "Idle")} />
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-lg border border-[#d0b06e]/30 bg-black/20 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
              {isChinese ? "下注区" : "Bets"}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label htmlFor="diceStakeInput" className="text-sm font-black text-[#fff4d8]">
                {isChinese ? "单次下注额" : "Stake"}
              </label>
              <input
                id="diceStakeInput"
                type="number"
                min={1}
                step={1}
                value={stake}
                onChange={(event) => setStake(clampInt(event.target.value, 1))}
                className="h-10 w-32 rounded-lg border border-[#d0b06e]/35 bg-black/25 px-3 text-base font-black text-[#fff4d8] outline-none transition focus:border-[#f0cf83]"
              />
              <p className="text-sm text-[#cbbd91]">
                {isChinese ? "点击下注卡片会按当前金额追加到该项。" : "Click a bet card to add the current stake."}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((chip, index) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setStake(chip)}
                  className={cn(
                    "min-h-12 min-w-20 rounded-full border-2 border-dashed border-white/45 px-4 text-base font-black text-white shadow-[inset_0_2px_10px_rgba(255,255,255,0.25),0_8px_16px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5",
                    stake === chip && "outline outline-2 outline-offset-2 outline-[#f0cf83]",
                    index % 5 === 0 && "bg-[radial-gradient(circle_at_30%_28%,#fff2cc,#d5a246)]",
                    index % 5 === 1 && "bg-[radial-gradient(circle_at_30%_28%,#ffe5e5,#d95b5b)]",
                    index % 5 === 2 && "bg-[radial-gradient(circle_at_30%_28%,#e2efff,#5f8fda)]",
                    index % 5 === 3 && "bg-[radial-gradient(circle_at_30%_28%,#e3ffe9,#4daa67)]",
                    index % 5 === 4 && "bg-[radial-gradient(circle_at_30%_28%,#f4e6ff,#8b62c9)]",
                  )}
                >
                  {formatMoney(chip)}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label htmlFor="diceInitialBankroll" className="text-sm font-black text-[#fff4d8]">
                {isChinese ? "初始资金" : "Initial bankroll"}
              </label>
              <input
                id="diceInitialBankroll"
                type="number"
                min={100}
                step={100}
                value={initialBankrollInput}
                disabled
                onChange={(event) => setInitialBankrollInput(event.target.value)}
                className="h-10 w-36 rounded-lg border border-[#d0b06e]/35 bg-black/25 px-3 text-base font-black text-[#fff4d8] outline-none transition focus:border-[#f0cf83]"
              />
              <label htmlFor="diceInitialChips" className="text-sm font-black text-[#fff4d8]">
                {isChinese ? "筹码面额" : "Chip values"}
              </label>
              <input
                id="diceInitialChips"
                type="text"
                value={initialChipsInput}
                onChange={(event) => setInitialChipsInput(event.target.value)}
                className="h-10 w-64 rounded-lg border border-[#d0b06e]/35 bg-black/25 px-3 text-base font-black text-[#fff4d8] outline-none transition focus:border-[#f0cf83]"
              />
              <button
                type="button"
                onClick={applyInitialSettings}
                className="h-10 rounded-lg border border-[#d0b06e]/35 bg-[#234b33] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#2d5b40]"
              >
                {isChinese ? "应用初始设置" : "Apply settings"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {diceBets.map((bet) => (
                <button
                  key={bet.key}
                  type="button"
                  onClick={() => addBet(bet.key)}
                  disabled={rolling}
                  className={cn(
                    "relative min-h-28 overflow-hidden rounded-lg border bg-card p-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.75)] transition hover:-translate-y-0.5 hover:border-primary/55 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)] disabled:cursor-not-allowed disabled:opacity-60",
                    "before:absolute before:inset-x-0 before:top-0 before:h-1.5",
                    bet.tone === "big" && "border-emerald-200/80 before:bg-emerald-500/80",
                    bet.tone === "small" && "border-teal-200/80 before:bg-teal-500/80",
                    bet.tone === "odd" && "border-rose-200/80 before:bg-rose-500/80",
                    bet.tone === "even" && "border-blue-200/80 before:bg-blue-500/80",
                    bet.tone === "triple" && "border-amber-200/90 before:bg-amber-500/85",
                    bets[bet.key] > 0 && "outline outline-2 outline-offset-1 outline-primary",
                  )}
                >
                  <span className="block text-xl font-black leading-tight text-foreground">
                    {isChinese ? bet.zh : bet.en}
                  </span>
                  <span className="mt-1 block text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {bet.en}
                  </span>
                  <span className="mt-3 block text-sm font-bold text-foreground">
                    {isChinese ? "赔率" : "Pays"} {bet.odds}
                  </span>
                  <span className="absolute bottom-3 right-3 rounded-full border border-border bg-muted px-3 py-1 text-sm font-black text-foreground">
                    {formatMoney(bets[bet.key])}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-[#d0b06e]/25">
              {diceBets.some((bet) => bets[bet.key] > 0) ? (
                diceBets
                  .filter((bet) => bets[bet.key] > 0)
                  .map((bet) => (
                    <div
                      key={bet.key}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-white/10 px-4 py-3 text-sm last:border-b-0"
                    >
                      <span className="font-black text-[#fff4d8]">
                        {isChinese ? bet.zh : bet.en}
                        <small className="mt-1 block font-normal text-[#cbbd91]">
                          {isChinese ? "赔率" : "Pays"} {bet.odds}
                        </small>
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={bets[bet.key]}
                        onChange={(event) => setBetAmount(bet.key, clampInt(event.target.value, 0))}
                        className="h-9 w-24 rounded-lg border border-[#d0b06e]/35 bg-black/25 px-3 text-sm font-black text-[#fff4d8]"
                      />
                      <button
                        type="button"
                        onClick={() => setBetAmount(bet.key, 0)}
                        className="rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-3 py-2 text-xs font-black text-[#fff4d8]"
                      >
                        {isChinese ? "清除" : "Clear"}
                      </button>
                    </div>
                  ))
              ) : (
                <div className="px-4 py-4 text-sm text-[#cbbd91]">
                  {isChinese ? "暂无下注，点上面的下注卡片开始。" : "No active bets yet."}
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-lg border border-[#d0b06e]/30 bg-black/25 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
              {isChinese ? "数学面板" : "Math"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label={isChinese ? "当前下注数" : "Bet count"} value={String(preview.count)} />
              <Metric label={isChinese ? "总下注" : "Total stake"} value={formatMoney(preview.totalStake)} />
              <Metric
                label={isChinese ? "理论 EV" : "Theoretical EV"}
                value={formatDelta(preview.expectedValue)}
                tone={preview.expectedValue >= 0 ? "good" : "bad"}
              />
              <Metric
                label={isChinese ? "累计 ROI" : "ROI"}
                value={formatPercent(roi)}
                tone={roi >= 0 ? "good" : "bad"}
              />
              <Metric
                label={isChinese ? "当前轮盈亏" : "Last delta"}
                value={formatDelta(stats.lastDelta)}
                tone={stats.lastDelta >= 0 ? "good" : "bad"}
              />
              <Metric
                label={isChinese ? "累计净盈亏" : "Net"}
                value={formatDelta(stats.totalDelta)}
                tone={stats.totalDelta >= 0 ? "good" : "bad"}
              />
            </div>

            <p className="mt-5 text-sm font-black text-[#d0b06e]">
              {isChinese ? "最近结果历史" : "Last 20 rounds"}
            </p>
            <div className="mt-3 grid max-h-[350px] gap-2 overflow-auto pr-1">
              {stats.history.length > 0 ? (
                stats.history.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-lg border border-white/15 bg-black/20 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-black text-[#fff4d8]">
                        {isChinese ? `第 ${record.round} 轮` : `Round ${record.round}`}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-black",
                          record.triple ? "bg-[#d0b06e]/30 text-[#ffeec7]" : record.delta >= 0 ? "bg-[#1f8a56]/35 text-[#9ff5c0]" : "bg-[#b2333f]/35 text-[#ffc3c8]",
                        )}
                      >
                        {record.triple ? (isChinese ? "豹子" : "Triple") : record.sum}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      {record.dice.map((value, index) => (
                        <span
                          key={`${record.id}-${index}`}
                          className="grid size-7 place-items-center rounded-lg border border-white/20 bg-white/10 text-xs font-black"
                        >
                          {value}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#cbbd91]">
                      {record.detail} · {formatDelta(record.delta)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-white/15 bg-black/20 p-3 text-sm text-[#cbbd91]">
                  {isChinese ? "这里会显示最近 20 轮结果。" : "Recent results will appear here."}
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>

      {showRules ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4">
          <div className="max-h-[86vh] w-full max-w-3xl overflow-auto rounded-lg border border-[#d0b06e]/45 bg-[#0b1c15] p-5 text-[#f8ecd2] shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-black">
                {isChinese ? "骰子游戏规则" : "Dice rules"}
              </h2>
              <button
                type="button"
                onClick={() => setShowRules(false)}
                className="rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-4 py-2 text-sm font-black transition hover:bg-[#214a35]"
              >
                {isChinese ? "关闭" : "Close"}
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-white/15">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-white/10 text-[#f4d18a]">
                  <tr>
                    <th className="border border-white/10 p-3">{isChinese ? "下注" : "Bet"}</th>
                    <th className="border border-white/10 p-3">{isChinese ? "赔付" : "Payout"}</th>
                    <th className="border border-white/10 p-3">{isChinese ? "说明" : "Description"}</th>
                  </tr>
                </thead>
                <tbody>
                  <RuleRow bet={isChinese ? "大" : "Big"} odds="1:1" note={isChinese ? "和值 11-17。" : "Total 11-17."} />
                  <RuleRow bet={isChinese ? "小" : "Small"} odds="1:1" note={isChinese ? "和值 4-10。" : "Total 4-10."} />
                  <RuleRow bet={isChinese ? "单" : "Odd"} odds="1:1" note={isChinese ? "和值为单数。" : "Odd total."} />
                  <RuleRow bet={isChinese ? "双" : "Even"} odds="1:1" note={isChinese ? "和值为双数。" : "Even total."} />
                  <RuleRow bet={isChinese ? "豹子" : "Triple"} odds="24:1" note={isChinese ? "三颗骰子完全相同。" : "All three dice match."} />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function MiniStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string
  tone?: "good" | "bad" | "neutral"
}) {
  return (
    <div className="rounded-lg border border-white/15 bg-black/20 p-3">
      <p className="text-xs font-bold text-[#cbbd91]">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-black",
          tone === "good" && "text-[#39d984]",
          tone === "bad" && "text-[#ff7474]",
          tone === "neutral" && "text-[#fff4d8]",
        )}
      >
        {value}
      </p>
    </div>
  )
}

function DieFace({
  value,
  label,
  rolling,
  index,
}: {
  value: number
  label: string
  rolling: boolean
  index: number
}) {
  const pips = pipPositions(value)

  return (
    <div className="grid min-h-40 place-items-center rounded-lg border border-[#d0b06e]/20 bg-[radial-gradient(circle_at_50%_0%,rgba(240,207,131,0.13),transparent_38%),linear-gradient(180deg,rgba(12,33,25,0.72),rgba(6,18,13,0.58))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_32px_rgba(0,0,0,0.28)]">
      <div
        className={cn(
          "relative grid aspect-square w-full max-w-[112px] grid-cols-3 grid-rows-3 rounded-[22px] border border-[#f4d79b]/55 bg-[radial-gradient(circle_at_30%_24%,#fff9eb_0%,#f2dcc1_38%,#c8945f_100%)] p-5 shadow-[inset_-10px_-12px_20px_rgba(72,39,16,0.34),inset_8px_8px_18px_rgba(255,255,255,0.72),0_16px_24px_rgba(0,0,0,0.32)] transition-transform duration-300",
          rolling && "motion-safe:animate-[dice-tumble_700ms_ease-in-out_infinite]",
        )}
        style={{ animationDelay: `${index * 90}ms` }}
        aria-label={`${label} ${value}`}
      >
        <div className="pointer-events-none absolute inset-1 rounded-[18px] border border-white/45" />
        <div className="pointer-events-none absolute left-4 top-3 h-5 w-8 rounded-full bg-white/45 blur-sm" />
        {pips.map((position) => (
          <span
            key={position}
            className={cn(
              "col-start-1 row-start-1 size-4 place-self-center rounded-full bg-[radial-gradient(circle_at_32%_28%,#332010_0%,#15100b_58%,#050302_100%)] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.2),0_1px_2px_rgba(255,255,255,0.35)]",
              pipPositionClass(position),
            )}
          />
        ))}
      </div>
      <div className="mt-3 flex w-full items-center justify-between gap-3 text-xs font-black tracking-[0.08em] text-[#f4e7ca]">
        <span>{label}</span>
        <span className="rounded-full border border-[#d0b06e]/35 bg-black/25 px-2 py-1 text-[#fff5dd]">
          {value}
        </span>
      </div>
    </div>
  )
}

function pipPositions(value: number) {
  const map: Record<number, number[]> = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9],
  }

  return map[value] ?? []
}

function pipPositionClass(position: number) {
  const map: Record<number, string> = {
    1: "col-start-1 row-start-1",
    2: "col-start-2 row-start-1",
    3: "col-start-3 row-start-1",
    4: "col-start-1 row-start-2",
    5: "col-start-2 row-start-2",
    6: "col-start-3 row-start-2",
    7: "col-start-1 row-start-3",
    8: "col-start-2 row-start-3",
    9: "col-start-3 row-start-3",
  }

  return map[position] ?? "col-start-2 row-start-2"
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string
  tone?: "good" | "bad" | "neutral"
}) {
  return (
    <div className="min-h-20 rounded-lg border border-[#d0b06e]/25 bg-black/20 p-3">
      <p className="text-xs font-bold text-[#cbbd91]">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-black",
          tone === "good" && "text-[#39d984]",
          tone === "bad" && "text-[#ff7474]",
          tone === "neutral" && "text-[#fff4d8]",
        )}
      >
        {value}
      </p>
    </div>
  )
}

function RuleRow({ bet, odds, note }: { bet: string; odds: string; note: string }) {
  return (
    <tr>
      <td className="border border-white/10 p-3 font-black">{bet}</td>
      <td className="border border-white/10 p-3 text-[#f4d18a]">{odds}</td>
      <td className="border border-white/10 p-3 text-[#d9ceb0]">{note}</td>
    </tr>
  )
}
