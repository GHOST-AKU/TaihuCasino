"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  BookOpen,
  RotateCcw,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react"

import { useLanguage } from "@/hooks/use-language"
import { type Language } from "@/lib/home-content"
import { type CasinoTableEntry } from "@/lib/game-catalog"
import { type MemberGameProgress, type MemberGameRound, type MemberTableSession } from "@/lib/member-data"
import { recordClientGameRound } from "@/lib/member-round-client"
import { cashOutClientTableSession, openClientTableSession } from "@/lib/table-session-client"
import { cn } from "@/lib/utils"

type BetKey = "player" | "banker" | "tie" | "playerPair" | "bankerPair"
type Winner = "P" | "B" | "T"
type Suit = "spades" | "hearts" | "diamonds" | "clubs"
type BaccaratSide = "player" | "banker"

interface BaccaratCard {
  rank: number
  suit: Suit
}

interface BaccaratRound {
  playerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  playerPoint: number
  bankerPoint: number
  winner: Winner
  playerPair: boolean
  bankerPair: boolean
}

interface BaccaratHistory extends BaccaratRound {
  id: string
  delta: number
  bankroll: number
  totalStake: number
  bets: BetLedger
  createdAt: string
}

interface BaccaratStats {
  rounds: number
  hitRounds: number
  totalStake: number
  totalDelta: number
  lastDelta: number
  ties: number
}

type BetLedger = Record<BetKey, number>

interface BaccaratDealStep {
  side: BaccaratSide
  card: BaccaratCard
  playerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  playerPoint?: number
  bankerPoint?: number
  zh: string
  en: string
}

interface BaccaratVisibleDeal {
  playerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  playerPoint?: number
  bankerPoint?: number
  activeSide?: BaccaratSide
}

const emptyBets: BetLedger = {
  player: 0,
  banker: 0,
  tie: 0,
  playerPair: 0,
  bankerPair: 0,
}

const betOptions = [
  {
    key: "player",
    zh: "闲",
    en: "Player",
    odds: "1:1",
    payout: 1,
    edge: -0.0124,
    tone: "player",
  },
  {
    key: "banker",
    zh: "庄",
    en: "Banker",
    odds: "0.95:1",
    payout: 0.95,
    edge: -0.0106,
    tone: "banker",
  },
  {
    key: "tie",
    zh: "和",
    en: "Tie",
    odds: "8:1",
    payout: 8,
    edge: -0.1436,
    tone: "tie",
  },
  {
    key: "playerPair",
    zh: "闲对子",
    en: "Player Pair",
    odds: "11:1",
    payout: 11,
    edge: -0.106,
    tone: "player",
  },
  {
    key: "bankerPair",
    zh: "庄对子",
    en: "Banker Pair",
    odds: "11:1",
    payout: 11,
    edge: -0.106,
    tone: "banker",
  },
] satisfies Array<{
  key: BetKey
  zh: string
  en: string
  odds: string
  payout: number
  edge: number
  tone: "player" | "banker" | "tie"
}>

const dealCardDelayMs = 220
const pointCheckDelayMs = 250
const settlementDelayMs = 200

const suits = ["spades", "hearts", "diamonds", "clubs"] satisfies Suit[]

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function cloneEmptyBets(): BetLedger {
  return { ...emptyBets }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
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

function clampPositiveInteger(value: unknown, fallback: number) {
  const parsed = Math.floor(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseChips(value: string, fallback: number[]) {
  const parsed = Array.from(
    new Set(
      value
        .split(",")
        .map((item) => clampPositiveInteger(item.trim(), 0))
        .filter((item) => item > 0),
    ),
  )
    .sort((a, b) => a - b)
    .slice(0, 8)

  return parsed.length > 0 ? parsed : fallback
}

function cardPoint(card: BaccaratCard) {
  return card.rank >= 10 ? 0 : card.rank
}

function handPoint(cards: BaccaratCard[]) {
  return cards.reduce((sum, card) => sum + cardPoint(card), 0) % 10
}

function hasPair(cards: BaccaratCard[]) {
  return cards.length >= 2 && cards[0].rank === cards[1].rank
}

function authoritativeBaccaratRound(snapshot: Record<string, unknown>): BaccaratRound | null {
  const parseCards = (value: unknown) => Array.isArray(value)
    ? value.flatMap((card) => {
        if (!card || typeof card !== "object" || Array.isArray(card)) return []
        const { rank, suit } = card as Record<string, unknown>
        return typeof rank === "number" && rank >= 1 && rank <= 13 && suits.includes(suit as Suit)
          ? [{ rank, suit: suit as Suit }]
          : []
      })
    : []
  const playerCards = parseCards(snapshot.playerCards)
  const bankerCards = parseCards(snapshot.bankerCards)
  const winner = snapshot.winner

  if (playerCards.length < 2 || bankerCards.length < 2 || (winner !== "P" && winner !== "B" && winner !== "T")) {
    return null
  }

  return {
    playerCards,
    bankerCards,
    playerPoint: handPoint(playerCards),
    bankerPoint: handPoint(bankerCards),
    winner,
    playerPair: hasPair(playerCards),
    bankerPair: hasPair(bankerCards),
  }
}

function baccaratStateFromRounds(rounds: MemberGameRound[], progress: MemberGameProgress | null) {
  const ordered = [...rounds].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )
  const history = ordered.flatMap((memberRound): BaccaratHistory[] => {
    const round = authoritativeBaccaratRound(memberRound.resultSnapshot)

    if (!round) {
      return []
    }

    const rawBets = memberRound.betSnapshot.bets
    const bets = cloneEmptyBets()

    if (rawBets && typeof rawBets === "object" && !Array.isArray(rawBets)) {
      for (const key of Object.keys(bets) as BetKey[]) {
        const value = (rawBets as Record<string, unknown>)[key]
        bets[key] = typeof value === "number" ? value : 0
      }
    }

    return [{
      ...round,
      id: memberRound.id,
      delta: memberRound.delta,
      bankroll: memberRound.chipBalanceAfter ?? 0,
      totalStake: memberRound.totalStake,
      bets,
      createdAt: memberRound.createdAt,
    }]
  }).slice(0, 30)
  const latest = history[0]

  return {
    lastRound: latest
      ? {
          playerCards: latest.playerCards,
          bankerCards: latest.bankerCards,
          playerPoint: latest.playerPoint,
          bankerPoint: latest.bankerPoint,
          winner: latest.winner,
          playerPair: latest.playerPair,
          bankerPair: latest.bankerPair,
        }
      : null,
    lastRoundId: latest?.id ?? null,
    history,
    stats: {
      rounds: progress?.plays ?? history.length,
      hitRounds: progress?.wins ?? history.filter((round) => round.delta > 0).length,
      totalStake: ordered.reduce((sum, round) => sum + round.totalStake, 0),
      totalDelta: ordered.reduce((sum, round) => sum + round.delta, 0),
      lastDelta: latest?.delta ?? progress?.lastDelta ?? 0,
      ties: history.filter((round) => round.winner === "T").length,
    } satisfies BaccaratStats,
  }
}

function createAuthoritativeDealSteps(round: BaccaratRound): BaccaratDealStep[] {
  const playerCards: BaccaratCard[] = []
  const bankerCards: BaccaratCard[] = []
  const steps: BaccaratDealStep[] = []

  function dealCard(side: BaccaratSide, card: BaccaratCard, zh: string, en: string) {
    if (side === "player") {
      playerCards.push(card)
    } else {
      bankerCards.push(card)
    }

    steps.push({
      side,
      card,
      playerCards: [...playerCards],
      bankerCards: [...bankerCards],
      playerPoint: playerCards.length > 0 ? handPoint(playerCards) : undefined,
      bankerPoint: bankerCards.length > 0 ? handPoint(bankerCards) : undefined,
      zh,
      en,
    })

  }

  dealCard("player", round.playerCards[0], "闲家第一张", "Player first card")
  dealCard("banker", round.bankerCards[0], "庄家第一张", "Banker first card")
  dealCard("player", round.playerCards[1], "闲家第二张", "Player second card")
  dealCard("banker", round.bankerCards[1], "庄家第二张", "Banker second card")

  if (round.playerCards[2]) {
    dealCard("player", round.playerCards[2], "闲家按规则补第三张", "Player draws the third card")
  }

  if (round.bankerCards[2]) {
    dealCard("banker", round.bankerCards[2], "庄家按规则补第三张", "Banker draws the third card")
  }

  return steps
}

function settleBets(
  result: Pick<BaccaratRound, "winner" | "playerPair" | "bankerPair">,
  bets: BetLedger,
) {
  let delta = 0

  if (result.winner === "P") {
    delta += bets.player
    delta -= bets.banker
    delta -= bets.tie
  }

  if (result.winner === "B") {
    delta += bets.banker * 0.95
    delta -= bets.player
    delta -= bets.tie
  }

  if (result.winner === "T") {
    delta += bets.tie * 8
  }

  delta += result.playerPair ? bets.playerPair * 11 : -bets.playerPair
  delta += result.bankerPair ? bets.bankerPair * 11 : -bets.bankerPair

  return roundMoney(delta)
}

function rankText(rank: number) {
  if (rank === 1) {
    return "A"
  }

  if (rank === 11) {
    return "J"
  }

  if (rank === 12) {
    return "Q"
  }

  if (rank === 13) {
    return "K"
  }

  return String(rank)
}

function suitText(suit: Suit) {
  if (suit === "spades") {
    return "♠"
  }

  if (suit === "hearts") {
    return "♥"
  }

  if (suit === "diamonds") {
    return "♦"
  }

  return "♣"
}

function isRedSuit(suit: Suit) {
  return suit === "hearts" || suit === "diamonds"
}

function winnerText(winner: Winner, language: Language) {
  if (language === "zh") {
    return winner === "P" ? "闲家" : winner === "B" ? "庄家" : "和局"
  }

  return winner === "P" ? "Player" : winner === "B" ? "Banker" : "Tie"
}

function winnerShort(winner: Winner) {
  return winner === "P" ? "P" : winner === "B" ? "B" : "T"
}

function betLabel(key: BetKey, language: Language) {
  const option = betOptions.find((item) => item.key === key)
  return language === "zh" ? option?.zh ?? key : option?.en ?? key
}

function calculatePreview(bets: BetLedger) {
  const totalStake = Object.values(bets).reduce((sum, value) => sum + value, 0)
  const expectedValue = betOptions.reduce(
    (sum, option) => sum + bets[option.key] * option.edge,
    0,
  )
  const scenarios: Array<Pick<BaccaratRound, "winner" | "playerPair" | "bankerPair">> = [
    { winner: "P", playerPair: false, bankerPair: false },
    { winner: "B", playerPair: false, bankerPair: false },
    { winner: "T", playerPair: false, bankerPair: false },
    { winner: "P", playerPair: true, bankerPair: false },
    { winner: "B", playerPair: false, bankerPair: true },
    { winner: "T", playerPair: true, bankerPair: true },
  ]
  const maxWin = totalStake
    ? Math.max(...scenarios.map((scenario) => settleBets(scenario, bets)))
    : 0

  return {
    count: Object.values(bets).filter((value) => value > 0).length,
    expectedValue: roundMoney(expectedValue),
    maxWin: roundMoney(maxWin),
    totalStake,
  }
}

async function persistServerProgress(
  entry: CasinoTableEntry,
  bets: BetLedger,
  idempotencyKey: string,
  tableSessionId: string,
) {
  return recordClientGameRound({
    gameSlug: entry.slug,
    idempotencyKey,
    tableSessionId,
    betSnapshot: {
      bets,
    },
  })
}

export function BaccaratTablePage({
  entry,
  defaultLanguage,
  initialWalletBalance,
  initialProgress,
  initialTableSession,
  initialGameRounds,
}: {
  entry: CasinoTableEntry
  defaultLanguage: Language
  initialWalletBalance: number
  initialProgress: MemberGameProgress | null
  initialTableSession: MemberTableSession | null
  initialGameRounds: MemberGameRound[]
}) {
  const [language] = useLanguage(defaultLanguage)
  const isChinese = language === "zh"
  const buyInWalletLabel = isChinese ? "主钱包余额" : "Main wallet"
  const tableChipsLabel = isChinese ? "桌台筹码（随输赢变化）" : "Table chips (changes each hand)"
  const mainWalletNote = isChinese ? "主钱包（买入/离桌时变化）" : "Main wallet (buy-in/cash-out only)"
  const buyInHint = isChinese
    ? "主钱包只在买入和离桌时变化；每手牌输赢会先结算到本桌筹码。"
    : "Your wallet changes on buy-in and cash-out. Each hand settles into table chips first."
  const isVip = Boolean(entry.variantOf)
  const initialBankroll = initialTableSession?.chipBalance ?? 0
  const defaultChips = isVip ? [100, 250, 500, 1000, 2500] : [10, 25, 50, 100, 250]
  const defaultStake = isVip ? 250 : 25
  const hydratedRoundState = baccaratStateFromRounds(initialGameRounds, initialProgress)

  const [bankroll, setBankroll] = useState(initialBankroll)
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance)
  const [tableSession, setTableSession] = useState<MemberTableSession | null>(initialTableSession)
  const [buyInAmount, setBuyInAmount] = useState(isVip ? 500 : 100)
  const [isOpeningSession, setIsOpeningSession] = useState(false)
  const [isCashingOut, setIsCashingOut] = useState(false)
  const [isSyncingRound, setIsSyncingRound] = useState(false)
  const [stake, setStake] = useState(defaultStake)
  const [chips, setChips] = useState(defaultChips)
  const [initialBankrollInput, setInitialBankrollInput] = useState(String(initialBankroll))
  const [initialChipsInput, setInitialChipsInput] = useState(defaultChips.join(","))
  const [bets, setBets] = useState<BetLedger>(() => cloneEmptyBets())
  const [lastRound, setLastRound] = useState<BaccaratRound | null>(hydratedRoundState.lastRound)
  const [history, setHistory] = useState<BaccaratHistory[]>(hydratedRoundState.history)
  const [stats, setStats] = useState<BaccaratStats>(hydratedRoundState.stats)
  const [message, setMessage] = useState(
    isChinese
      ? "选择筹码并点击下注区域，准备下一手。"
      : "Choose a chip and click a betting area to prepare the next hand.",
  )
  const [dealing, setDealing] = useState(false)
  const [pendingRoundKey, setPendingRoundKey] = useState<string | null>(null)
  const [lastRoundId, setLastRoundId] = useState<string | null>(hydratedRoundState.lastRoundId)
  const [dealProgress, setDealProgress] = useState(0)
  const [visibleDeal, setVisibleDeal] = useState<BaccaratVisibleDeal | null>(null)
  const [showRules, setShowRules] = useState(false)

  const storageKey = `taihu-baccarat-table-${entry.slug}`
  const preview = useMemo(() => calculatePreview(bets), [bets])
  const activeBets = useMemo(
    () =>
      betOptions
        .map((option) => ({ ...option, amount: bets[option.key] }))
        .filter((option) => option.amount > 0),
    [bets],
  )
  const roi = stats.totalStake > 0 ? (stats.totalDelta / stats.totalStake) * 100 : 0
  const tieRate = stats.rounds > 0 ? (stats.ties / stats.rounds) * 100 : 0
  const tableTitle = isChinese ? entry.titleZh : entry.title
  const displayPlayerCards = visibleDeal?.playerCards ?? lastRound?.playerCards ?? []
  const displayBankerCards = visibleDeal?.bankerCards ?? lastRound?.bankerCards ?? []
  const displayPlayerPoint = visibleDeal?.playerPoint ?? lastRound?.playerPoint
  const displayBankerPoint = visibleDeal?.bankerPoint ?? lastRound?.bankerPoint
  const displayWinner = dealing ? undefined : lastRound?.winner

  useEffect(() => {
    if (!initialTableSession) {
      window.localStorage.removeItem(storageKey)
      setWalletBalance(initialWalletBalance)
      setTableSession(null)
      setBankroll(0)
      setInitialBankrollInput("0")
      setBets(cloneEmptyBets())
      setHistory([])
      setLastRound(null)
      setVisibleDeal(null)
      setDealProgress(0)
      return
    }

    const saved = window.localStorage.getItem(storageKey)

    if (!saved) {
      return
    }

    try {
      const parsed = JSON.parse(saved) as {
        chips?: number[]
        stake?: number
      }

      if (Array.isArray(parsed.chips) && parsed.chips.every((chip) => typeof chip === "number")) {
        setChips(parsed.chips)
        setInitialChipsInput(parsed.chips.join(","))
      }

      if (typeof parsed.stake === "number") {
        setStake(parsed.stake)
      }

    } catch {
      window.localStorage.removeItem(storageKey)
    }

    const syncedBankroll = initialTableSession?.chipBalance ?? initialProgress?.bankroll ?? 0
    setWalletBalance(initialWalletBalance)
    setTableSession(initialTableSession)
    setBankroll(syncedBankroll)
    setInitialBankrollInput(String(syncedBankroll))

    if (initialProgress) {
      const hydrated = baccaratStateFromRounds(initialGameRounds, initialProgress)
      setLastRound(hydrated.lastRound)
      setLastRoundId(hydrated.lastRoundId)
      setHistory(hydrated.history)
      setStats(hydrated.stats)
    }
  }, [storageKey, initialProgress, initialWalletBalance, initialTableSession, initialGameRounds])

  function persistLocal(nextStake = stake, nextChips = chips) {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        chips: nextChips,
        stake: nextStake,
      }),
    )
  }

  function addBet(key: BetKey) {
    const amount = clampPositiveInteger(stake, defaultStake)

    if (preview.totalStake + amount > bankroll) {
      setMessage(isChinese ? "余额不足，先清空或降低下注额。" : "Insufficient bankroll. Clear or lower the stake first.")
      return
    }

    setBets((current) => ({
      ...current,
      [key]: roundMoney(current[key] + amount),
    }))
    setMessage(
      isChinese
        ? `${betLabel(key, language)} 追加 ${formatMoney(amount)}。`
        : `${betLabel(key, language)} added ${formatMoney(amount)}.`,
    )
  }

  function clearBets() {
    setBets(cloneEmptyBets())
    setMessage(isChinese ? "下注已清空。" : "Bets cleared.")
  }

  function applyInitialSettings() {
    const nextChips = parseChips(initialChipsInput, defaultChips)

    setChips(nextChips)
    setStake(nextChips[0])
    setBets(cloneEmptyBets())
    setVisibleDeal(null)
    setDealProgress(0)
    persistLocal(nextChips[0], nextChips)
    setMessage(isChinese ? "筹码面额与下注设置已更新。" : "Chip values and betting preferences were updated.")
  }

  function resetTable() {
    setInitialBankrollInput(String(tableSession?.chipBalance ?? 0))
    setChips(defaultChips)
    setInitialChipsInput(defaultChips.join(","))
    setStake(defaultStake)
    setBets(cloneEmptyBets())
    setVisibleDeal(null)
    setDealProgress(0)
    window.localStorage.removeItem(storageKey)
    setMessage(isChinese ? "下注与界面偏好已重置；权威结果和余额保持不变。" : "Bets and UI preferences reset; authoritative results and bankroll were kept.")
  }

  async function openSession() {
    const amount = Math.min(1000000, Math.max(1, roundMoney(Number(buyInAmount))))

    if (amount > walletBalance) {
      setMessage(isChinese ? "钱包余额不足，无法买入这笔筹码。" : "Wallet balance is not enough for this buy-in.")
      return
    }

    setIsOpeningSession(true)
    setMessage(isChinese ? "正在从钱包买入桌台筹码..." : "Buying chips from your wallet...")

    try {
      const result = await openClientTableSession(entry.slug, amount, "baccarat-buy-in")

      setTableSession(result.tableSession)
      setBankroll(result.tableSession.chipBalance)
      setInitialBankrollInput(String(result.tableSession.chipBalance))
      setWalletBalance(result.walletBalance ?? walletBalance - amount)
      setBets(cloneEmptyBets())
      window.localStorage.removeItem(storageKey)
      setMessage(isChinese ? "买入成功，桌台筹码已准备好。" : "Buy-in complete. Table chips are ready.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "买入失败。" : "Buy-in failed.")
    } finally {
      setIsOpeningSession(false)
    }
  }

  async function cashOutSession() {
    if (!tableSession || isCashingOut || dealing) {
      return
    }

    setIsCashingOut(true)
    setMessage(isChinese ? "正在带走筹码并结算回钱包..." : "Cashing out table chips to your wallet...")

    try {
      const result = await cashOutClientTableSession(tableSession.id, "baccarat-cash-out")

      setTableSession(null)
      setBankroll(0)
      setInitialBankrollInput("0")
      setWalletBalance(result.walletBalance ?? walletBalance + tableSession.chipBalance)
      setBets(cloneEmptyBets())
      window.localStorage.removeItem(storageKey)
      setMessage(isChinese ? "筹码已带走，余额已回到钱包。" : "Chips cashed out. Balance returned to wallet.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "离桌失败。" : "Cash-out failed.")
    } finally {
      setIsCashingOut(false)
    }
  }

  async function settleRound() {
    if (dealing) {
      return
    }

    if (!tableSession) {
      setMessage(isChinese ? "请先从钱包买入筹码再入桌。" : "Buy in from your wallet before playing this table.")
      return
    }
    const activeTableSession = tableSession

    if (preview.totalStake <= 0) {
      setMessage(isChinese ? "请先在下注区放筹码。" : "Place at least one bet first.")
      return
    }

    if (preview.totalStake > bankroll) {
      setMessage(isChinese ? "总下注额超过余额。" : "Total stake exceeds the bankroll.")
      return
    }

    const betsThisRound = { ...bets }
    const languageThisRound = language
    const isChineseThisRound = languageThisRound === "zh"
    const idempotencyKey = pendingRoundKey ?? `baccarat-${entry.slug}-${crypto.randomUUID()}`

    setDealing(true)
    setIsSyncingRound(true)
    setPendingRoundKey(idempotencyKey)
    setDealProgress(4)
    setVisibleDeal(null)
    setMessage(
      isChineseThisRound
        ? "正在等待服务端生成权威牌局..."
        : "Waiting for the server to generate the authoritative hand...",
    )

    let serverResult: Awaited<ReturnType<typeof persistServerProgress>>

    try {
      serverResult = await persistServerProgress(
        entry,
        betsThisRound,
        idempotencyKey,
        activeTableSession.id,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChineseThisRound ? "结算未完成，请使用同一回合重试。" : "Settlement did not complete; retry the same round.")
      setIsSyncingRound(false)
      setDealing(false)
      return
    }

    const envelope = serverResult.round
    const round = envelope ? authoritativeBaccaratRound(envelope.resultSnapshot) : null

    if (!envelope || !round) {
      setMessage(isChineseThisRound ? "服务端未返回有效的权威牌局。" : "The server did not return a valid authoritative hand.")
      setIsSyncingRound(false)
      setDealing(false)
      return
    }

    setIsSyncingRound(false)
    setVisibleDeal({ playerCards: [], bankerCards: [] })
    setMessage(
      isChineseThisRound
        ? "荷官开始按服务端牌序发牌：闲、庄、闲、庄。"
        : "Dealer starts with the server-provided order: Player, Banker, Player, Banker.",
    )

    const steps = createAuthoritativeDealSteps(round)

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index]

      await sleep(index === 0 ? 160 : dealCardDelayMs)
      setVisibleDeal({
        playerCards: step.playerCards,
        bankerCards: step.bankerCards,
        playerPoint: step.playerPoint,
        bankerPoint: step.bankerPoint,
        activeSide: step.side,
      })
      setDealProgress(Math.round(((index + 1) / (steps.length + 2)) * 82))
      setMessage(
        isChineseThisRound
          ? `发牌顺序：${step.zh}（${rankText(step.card.rank)}${suitText(step.card.suit)}）。`
          : `Deal order: ${step.en} (${rankText(step.card.rank)}${suitText(step.card.suit)}).`,
      )
    }

    setVisibleDeal({
      playerCards: round.playerCards,
      bankerCards: round.bankerCards,
      playerPoint: round.playerPoint,
      bankerPoint: round.bankerPoint,
    })
    setDealProgress(88)
    setMessage(
      isChineseThisRound
        ? `牌面已亮：闲 ${round.playerPoint} 点，庄 ${round.bankerPoint} 点。荷官核对牌面。`
        : `Cards are shown: Player ${round.playerPoint}, Banker ${round.bankerPoint}. Dealer verifies the hand.`,
    )

    await sleep(pointCheckDelayMs)

    const nextBankroll = envelope.chipBalanceAfter
    const record: BaccaratHistory = {
      ...round,
      id: envelope.roundId,
      delta: envelope.delta,
      bankroll: nextBankroll,
      totalStake: envelope.totalStake,
      bets: betsThisRound,
      createdAt: envelope.serverTimestamp,
    }
    const nextHistory = [record, ...history].slice(0, 30)
    const nextStats: BaccaratStats = {
      rounds: stats.rounds + 1,
      hitRounds: stats.hitRounds + (envelope.delta > 0 ? 1 : 0),
      totalStake: roundMoney(stats.totalStake + envelope.totalStake),
      totalDelta: roundMoney(stats.totalDelta + envelope.delta),
      lastDelta: envelope.delta,
      ties: stats.ties + (round.winner === "T" ? 1 : 0),
    }

    setDealProgress(96)
    setMessage(
      isChineseThisRound
        ? `结算中：${winnerText(round.winner, languageThisRound)}胜，本轮 ${formatDelta(envelope.delta)}，请稍候。`
        : `Settling: ${winnerText(round.winner, languageThisRound)} wins, round ${formatDelta(envelope.delta)}. Please wait.`,
    )

    await sleep(settlementDelayMs)

    setLastRound(round)
    setBankroll(nextBankroll)
    setTableSession({ ...activeTableSession, chipBalance: nextBankroll })
    setHistory(nextHistory)
    setStats(nextStats)
    setBets(cloneEmptyBets())
    setLastRoundId(envelope.roundId)
    setPendingRoundKey(null)
    setVisibleDeal(null)
    setDealProgress(100)
    setMessage(envelope.summary)
    persistLocal()
    setDealing(false)
  }

  return (
    <main data-round-id={lastRoundId ?? undefined} className="game-table-shell lobby-shell min-h-screen overflow-hidden bg-background text-foreground">
      <div className="mx-auto grid max-w-[1660px] gap-3 px-4 py-4 lg:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/?lang=${language}`}
              aria-label={isChinese ? "返回大厅" : "Back to lobby"}
              className="grid size-10 place-items-center rounded-lg border border-[#d0b06e]/35 bg-black/20 text-[#f8ecd2] transition hover:bg-[#d0b06e]/15"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d0b06e]">
                {isChinese ? "百家乐实桌" : "Baccarat live table"}
              </p>
              <h1 className="text-2xl font-black tracking-normal text-[#fff4d8] md:text-4xl">
                {tableTitle}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRules(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#214a35] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <BookOpen className="size-4" />
              {isChinese ? "玩法说明" : "Rules"}
            </button>
            <button
              type="button"
              onClick={clearBets}
              disabled={dealing}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#214a35] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Trash2 className="size-4" />
              {isChinese ? "清空下注" : "Clear"}
            </button>
            <button
              type="button"
              onClick={resetTable}
              disabled={dealing}
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
                  {buyInHint}
                </p>
                <p className="mt-3 text-sm font-black text-[#f4d18a]">
                  {buyInWalletLabel} {formatMoney(walletBalance)}
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
                  <label htmlFor="baccaratBuyInAmount" className="text-sm font-black text-[#fff4d8]">
                    {isChinese ? "买入金额" : "Buy-in amount"}
                  </label>
                  <input
                    id="baccaratBuyInAmount"
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
                  {(isVip ? [500, 1000, 2500] : [100, 250, 500]).map((amount) => (
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

        <section className="grid gap-3 lg:grid-cols-[1.16fr_0.84fr]">
          <div className="rounded-lg border border-[#d0b06e]/30 bg-white/[0.035] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
                  {isChinese ? "资金与发牌" : "Bankroll & Deal"}
                </p>
                <p className="mt-3 text-sm text-[#cbbd91]">{tableChipsLabel}</p>
                <p className="text-5xl font-black leading-none text-[#f4d18a] md:text-6xl">
                  {formatMoney(bankroll)}
                </p>
                <p className="mt-2 text-xs font-bold text-[#cbbd91]">
                  {mainWalletNote} {formatMoney(walletBalance)}
                </p>
              </div>

              {tableSession ? (
                <button
                  type="button"
                  onClick={cashOutSession}
                  disabled={dealing || isCashingOut || isSyncingRound}
                  className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#214a35] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isCashingOut ? (isChinese ? "离桌中..." : "Cashing out...") : isChinese ? "带走筹码" : "Cash out"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={settleRound}
                disabled={dealing || !tableSession}
                className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[#d0b06e]/50 bg-gradient-to-b from-[#f0cf83] to-[#c69d55] px-5 text-base font-black text-[#34240a] shadow-[0_14px_28px_rgba(0,0,0,0.26)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Sparkles className="size-5" />
                {dealing ? (isChinese ? "发牌中" : "Dealing") : isChinese ? "发牌结算" : "Deal"}
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <ResultBox
                label={isChinese ? "本局结果" : "Result"}
                value={dealing ? (isChinese ? "发牌中" : "Dealing") : lastRound ? winnerText(lastRound.winner, language) : "--"}
                tone={displayWinner}
              />
              <ResultBox
                label={isChinese ? "闲点数" : "Player point"}
                value={displayPlayerPoint === undefined ? "--" : String(displayPlayerPoint)}
                tone="P"
              />
              <ResultBox
                label={isChinese ? "庄点数" : "Banker point"}
                value={displayBankerPoint === undefined ? "--" : String(displayBankerPoint)}
                tone="B"
              />
            </div>

            <div className="mt-4 text-lg font-black text-[#fff4d8]">{message}</div>
            <div className="mt-4 h-2 overflow-hidden rounded-full border border-white/10 bg-black/25">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r from-transparent via-[#f0cf83] to-transparent transition-all duration-700",
                )}
                style={{ width: `${dealing ? dealProgress : 0}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-[#cbbd91]">
              {isChinese
                ? "规则：8副牌，庄赢抽佣5%，和局赔率8:1，闲/庄对子赔率11:1。"
                : "Rules: 8 decks, 5% commission on Banker wins, Tie pays 8:1, Player/Banker Pair pay 11:1."}
            </p>
          </div>

          <div className="rounded-lg border border-[#d0b06e]/30 bg-white/[0.035] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <p className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
              {isChinese ? "发牌可视化" : "Deal visualization"}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <HandPanel
                label={isChinese ? "闲家" : "Player"}
                badge="PLAYER"
                cards={displayPlayerCards}
                point={displayPlayerPoint}
                tone="player"
                active={visibleDeal?.activeSide === "player"}
                emptyText={isChinese ? "等待发牌" : "Waiting for deal"}
              />
              <HandPanel
                label={isChinese ? "庄家" : "Banker"}
                badge="BANKER"
                cards={displayBankerCards}
                point={displayBankerPoint}
                tone="banker"
                active={visibleDeal?.activeSide === "banker"}
                emptyText={isChinese ? "等待发牌" : "Waiting for deal"}
              />
            </div>
            <p className="mt-4 text-lg font-black text-[#f4d18a]">
              {isChinese ? "牌局来源：服务端权威牌序" : "Hand source: authoritative server order"}
            </p>
          </div>
        </section>

        <section className="grid items-start gap-3 lg:grid-cols-[1.38fr_0.62fr]">
          <div className="rounded-lg border border-[#d0b06e]/30 bg-black/20 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <p className="mr-auto text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
                {isChinese ? "下注区" : "Betting area"}
              </p>
              <label htmlFor="stakeInput" className="text-sm font-black text-[#fff4d8]">
                {isChinese ? "当前每注金额" : "Current stake"}
              </label>
              <input
                id="stakeInput"
                type="number"
                min={1}
                step={1}
                value={stake}
                disabled={dealing}
                onChange={(event) => setStake(clampPositiveInteger(event.target.value, defaultStake))}
                className="h-10 w-32 rounded-lg border border-[#d0b06e]/35 bg-black/25 px-3 text-base font-black text-[#fff4d8] outline-none transition focus:border-[#f0cf83] disabled:cursor-not-allowed disabled:opacity-55"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((chip, index) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setStake(chip)}
                  disabled={dealing}
                  className={cn(
                    "min-h-10 min-w-16 rounded-full border-2 border-dashed border-white/45 px-4 text-sm font-black text-white shadow-[inset_0_2px_10px_rgba(255,255,255,0.25),0_8px_16px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55",
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

            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
              <label htmlFor="initialBankrollInput" className="text-sm font-black text-[#fff4d8]">
                {isChinese ? "初始资金" : "Initial bankroll"}
              </label>
              <input
                id="initialBankrollInput"
                type="number"
                min={100}
                step={100}
                value={initialBankrollInput}
                disabled={dealing}
                onChange={(event) => setInitialBankrollInput(event.target.value)}
                className="h-10 w-36 rounded-lg border border-[#d0b06e]/35 bg-black/25 px-3 text-base font-black text-[#fff4d8] outline-none transition focus:border-[#f0cf83] disabled:cursor-not-allowed disabled:opacity-55"
              />
              <label htmlFor="initialChipsInput" className="text-sm font-black text-[#fff4d8]">
                {isChinese ? "筹码面额" : "Chip values"}
              </label>
              <input
                id="initialChipsInput"
                type="text"
                value={initialChipsInput}
                disabled={dealing}
                onChange={(event) => setInitialChipsInput(event.target.value)}
                className="h-10 w-64 rounded-lg border border-[#d0b06e]/35 bg-black/25 px-3 text-base font-black text-[#fff4d8] outline-none transition focus:border-[#f0cf83] disabled:cursor-not-allowed disabled:opacity-55"
              />
              <button
                type="button"
                onClick={applyInitialSettings}
                disabled={dealing}
                className="h-10 rounded-lg border border-[#d0b06e]/35 bg-[#234b33] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#2d5b40] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isChinese ? "应用初始设置" : "Apply settings"}
              </button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {betOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => addBet(option.key)}
                  disabled={dealing}
                  className={cn(
                    "relative min-h-[84px] overflow-hidden rounded-lg border p-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_18px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_22px_rgba(0,0,0,0.18)]",
                    option.tone === "player" && "border-[#9db2dd] bg-[linear-gradient(180deg,rgba(55,91,191,.24),rgba(255,255,255,.78))] text-[#10213f] dark:border-white/20 dark:bg-[linear-gradient(180deg,rgba(55,91,191,.35),rgba(0,0,0,.2))] dark:text-[#f5ecd6]",
                    option.tone === "banker" && "border-[#d5a0a5] bg-[linear-gradient(180deg,rgba(178,51,63,.24),rgba(255,255,255,.78))] text-[#371316] dark:border-white/20 dark:bg-[linear-gradient(180deg,rgba(178,51,63,.35),rgba(0,0,0,.2))] dark:text-[#f5ecd6]",
                    option.tone === "tie" && "border-[#86c39d] bg-[linear-gradient(180deg,rgba(31,138,86,.24),rgba(255,255,255,.78))] text-[#0d2b1c] dark:border-white/20 dark:bg-[linear-gradient(180deg,rgba(31,138,86,.33),rgba(0,0,0,.2))] dark:text-[#f5ecd6]",
                    bets[option.key] > 0 && "ring-2 ring-[#f0cf83] ring-offset-1 ring-offset-background",
                  )}
                >
                  <span className="block text-lg font-black leading-none text-inherit">
                    {isChinese ? option.zh : option.en}
                  </span>
                  {isChinese ? (
                    <span className="mt-0.5 block text-base font-black leading-none text-inherit">
                      {option.en}
                    </span>
                  ) : null}
                  <span className="mt-2 block text-xs font-bold text-[#806b22] dark:text-[#bcae86]">
                    {isChinese ? "赔率" : "Pays"} {option.odds}
                  </span>
                  <span className="absolute bottom-2.5 right-2.5 grid min-w-8 place-items-center rounded-full bg-white/85 px-2 py-1 text-xs font-black text-[#047857] shadow-[0_4px_10px_rgba(0,0,0,0.18)] dark:bg-black/45 dark:text-[#19d79a]">
                    {formatMoney(bets[option.key])}
                  </span>
                </button>
              ))}
            </div>

            {activeBets.length > 0 ? (
              <div className="mt-3 overflow-hidden rounded-lg border border-[#d0b06e]/25">
                {activeBets.map((bet) => (
                  <div
                    key={bet.key}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-white/10 px-4 py-3 text-sm last:border-b-0"
                  >
                    <span className="font-black text-[#fff4d8]">
                      {isChinese ? bet.zh : bet.en}
                    </span>
                    <span className="text-[#cbbd91]">{bet.odds}</span>
                    <span className="font-black text-[#f4d18a]">{formatMoney(bet.amount)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <aside className="rounded-lg border border-[#d0b06e]/30 bg-black/25 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
              {isChinese ? "数学计算 & 统计" : "Math & stats"}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label={isChinese ? "当前注单数" : "Bet count"} value={String(preview.count)} />
              <Metric label={isChinese ? "总下注额" : "Total stake"} value={formatMoney(preview.totalStake)} />
              <Metric
                label={isChinese ? "理论 EV" : "Theoretical EV"}
                value={formatDelta(preview.expectedValue)}
                tone={preview.expectedValue < 0 ? "bad" : preview.expectedValue > 0 ? "good" : "neutral"}
              />
              <Metric label={isChinese ? "本轮可能最大净赢" : "Max net win"} value={formatMoney(preview.maxWin)} />
              <Metric
                label={isChinese ? "上轮净盈亏" : "Last delta"}
                value={formatDelta(stats.lastDelta)}
                tone={stats.lastDelta < 0 ? "bad" : stats.lastDelta > 0 ? "good" : "neutral"}
              />
              <Metric
                label={isChinese ? "局数 / 命中局" : "Rounds / hits"}
                value={`${stats.rounds} / ${stats.hitRounds}`}
              />
              <Metric
                label={isChinese ? "累计 ROI" : "ROI"}
                value={formatPercent(roi)}
                tone={roi < 0 ? "bad" : roi > 0 ? "good" : "neutral"}
              />
              <Metric label={isChinese ? "和局占比" : "Tie rate"} value={formatPercent(tieRate)} />
            </div>

            <div className="mt-5">
              <p className="text-sm font-black text-[#d0b06e]">
                {isChinese ? "近 30 局路单" : "Last 30 outcomes"}
              </p>
              <div className="mt-3 flex min-h-8 flex-wrap gap-2">
                {history.length > 0 ? (
                  history
                    .slice()
                    .reverse()
                    .map((record) => (
                      <span
                        key={record.id}
                        className={cn(
                          "grid size-8 place-items-center rounded-full border border-white/20 text-xs font-black",
                          record.winner === "P" && "bg-[#375bbf]/45 text-white",
                          record.winner === "B" && "bg-[#b2333f]/45 text-white",
                          record.winner === "T" && "bg-[#1f8a56]/45 text-white",
                        )}
                        title={`${winnerText(record.winner, language)} ${record.playerPoint}:${record.bankerPoint}`}
                      >
                        {winnerShort(record.winner)}
                      </span>
                    ))
                ) : (
                  <span className="text-sm text-[#cbbd91]">
                    {isChinese ? "还没有路单。" : "No road history yet."}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-[#d0b06e]/25 bg-black/20 p-3">
              <p className="text-sm font-black text-[#d0b06e]">
                {isChinese ? "最近结算" : "Recent hands"}
              </p>
              <div className="mt-3 grid gap-2">
                {history.slice(0, 4).map((record) => (
                  <div
                    key={record.id}
                    className="grid grid-cols-[1fr_auto] gap-3 rounded-md bg-white/[0.035] px-3 py-2 text-sm"
                  >
                    <span className="text-[#d9ceb0]">
                      {winnerText(record.winner, language)} {record.playerPoint}:{record.bankerPoint}
                    </span>
                    <span
                      className={cn(
                        "font-black",
                        record.delta > 0 && "text-[#39d984]",
                        record.delta < 0 && "text-[#ff7474]",
                        record.delta === 0 && "text-[#f4d18a]",
                      )}
                    >
                      {formatDelta(record.delta)}
                    </span>
                  </div>
                ))}
                {history.length === 0 ? (
                  <p className="text-sm text-[#cbbd91]">
                    {isChinese ? "发牌后这里会显示最近牌局。" : "Recent hands appear after dealing."}
                  </p>
                ) : null}
              </div>
            </div>
          </aside>
        </section>
      </div>

      {showRules ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4">
          <div className="max-h-[86vh] w-full max-w-3xl overflow-auto rounded-lg border border-[#d0b06e]/45 bg-[#0b1c15] p-5 text-[#f8ecd2] shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-black">
                {isChinese ? "百家乐下注说明（常见 8 副牌规则）" : "Baccarat betting rules (8-deck common table)"}
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
                    <th className="border border-white/10 p-3">{isChinese ? "下注类型" : "Bet"}</th>
                    <th className="border border-white/10 p-3">{isChinese ? "赔率" : "Payout"}</th>
                    <th className="border border-white/10 p-3">{isChinese ? "说明" : "Description"}</th>
                  </tr>
                </thead>
                <tbody>
                  <RuleRow bet={isChinese ? "闲" : "Player"} odds="1:1" note={isChinese ? "闲点数大于庄点数时赢。" : "Wins when Player point is higher than Banker."} />
                  <RuleRow bet={isChinese ? "庄" : "Banker"} odds="0.95:1" note={isChinese ? "庄赢扣 5% 佣金。" : "Wins pay 0.95 after 5% commission."} />
                  <RuleRow bet={isChinese ? "和" : "Tie"} odds="8:1" note={isChinese ? "闲庄点数相同时赢，庄/闲主注退回。" : "Wins when points match; Player/Banker main bets push."} />
                  <RuleRow bet={isChinese ? "闲对子" : "Player Pair"} odds="11:1" note={isChinese ? "闲家前两张牌同点数时赢。" : "Wins when Player first two cards share a rank."} />
                  <RuleRow bet={isChinese ? "庄对子" : "Banker Pair"} odds="11:1" note={isChinese ? "庄家前两张牌同点数时赢。" : "Wins when Banker first two cards share a rank."} />
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <RuleCard
                title={isChinese ? "发牌顺序" : "Deal order"}
                body={
                  isChinese
                    ? "每局先给闲家两张、再给庄家两张；若任一方前两张合计为 8 或 9，立即停牌并直接比较点数。"
                    : "Player receives two cards, then Banker receives two cards. A natural 8 or 9 stops the draw immediately."
                }
              />
              <RuleCard
                title={isChinese ? "点数计算" : "Point total"}
                body={
                  isChinese
                    ? "A 记 1 点，2-9 按牌面记点，10/J/Q/K 都算 0 点，只取个位数，例如 7+8=5 点。"
                    : "A counts as 1, 2-9 keep face value, 10/J/Q/K count as 0, and only the last digit matters."
                }
              />
              <RuleCard
                title={isChinese ? "闲家补牌" : "Player draw rule"}
                body={
                  isChinese
                    ? "闲家两张合计 0-5 点补第三张，6-7 点停牌；8-9 点属于自然牌，前面已经直接结算。"
                    : "Player draws on totals 0-5 and stands on 6-7. Naturals 8-9 are already settled before this step."
                }
              />
              <RuleCard
                title={isChinese ? "庄家补牌" : "Banker draw rule"}
                body={
                  isChinese
                    ? "若闲家未补牌，庄家 0-5 点补牌、6-7 点停牌；若闲家已补第三张，庄家按百家乐标准第三张规则决定是否补牌。"
                    : "If Player stands, Banker draws on 0-5 and stands on 6-7. If Player draws a third card, Banker follows the standard baccarat third-card matrix."
                }
              />
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4 text-sm leading-6 text-[#d9ceb0]">
              <p className="font-black text-[#f4d18a]">
                {isChinese ? "庄家第三张补牌速记" : "Banker third-card quick guide"}
              </p>
              <p className="mt-2">
                {isChinese
                  ? "庄家 0-2 点一定补牌；3 点时闲家第三张不是 8 才补；4 点时闲家第三张为 2-7 才补；5 点时闲家第三张为 4-7 才补；6 点时闲家第三张为 6 或 7 才补。"
                  : "Banker draws on 0-2 always; on 3 unless Player's third card is 8; on 4 when Player's third card is 2-7; on 5 when it is 4-7; on 6 when it is 6-7."}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function ResultBox({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: Winner
}) {
  return (
    <div className="rounded-lg border border-white/15 bg-black/20 p-3">
      <p className="text-xs font-bold text-[#cbbd91]">{label}</p>
      <p
        className={cn(
          "mt-1 text-3xl font-black",
          tone === "P" && "text-[#b8ccff]",
          tone === "B" && "text-[#ffc1c5]",
          tone === "T" && "text-[#7dedae]",
          !tone && "text-[#fff4d8]",
        )}
      >
        {value}
      </p>
    </div>
  )
}

function HandPanel({
  label,
  badge,
  cards,
  point,
  tone,
  active,
  emptyText,
}: {
  label: string
  badge: string
  cards: BaccaratCard[]
  point?: number
  tone: "player" | "banker"
  active?: boolean
  emptyText: string
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[#d0b06e]/30 bg-black/20 p-3 transition",
        active && "border-[#f0cf83]/80 shadow-[0_0_24px_rgba(240,207,131,0.18)]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-base font-black text-[#fff4d8]">{label}</p>
          <span
            className={cn(
              "rounded-full border border-white/25 px-3 py-0.5 text-xs font-black",
              tone === "player" && "bg-[#375bbf]/30 text-[#d7e2ff]",
              tone === "banker" && "bg-[#b2333f]/30 text-[#ffd5d9]",
            )}
          >
            {badge}
          </span>
        </div>
        <span className="text-lg font-black text-[#f4d18a]">{point ?? "--"}</span>
      </div>
      <div className="mt-4 flex min-h-20 flex-wrap gap-2">
        {cards.length > 0 ? (
          cards.map((card, index) => (
            <PlayingCard
              key={`${card.rank}-${card.suit}-${index}`}
              card={card}
              index={index}
              active={Boolean(active && index === cards.length - 1)}
            />
          ))
        ) : (
          <span className="text-sm text-[#cbbd91]">{emptyText}</span>
        )}
      </div>
    </div>
  )
}

function PlayingCard({ card, index, active }: { card: BaccaratCard; index: number; active?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-[76px] w-[54px] place-items-center rounded-lg border border-black/20 bg-gradient-to-b from-[#fff9eb] to-[#ddd1b6] text-lg font-black text-[#1d160d] shadow-[0_8px_14px_rgba(0,0,0,0.22)] transition",
        active && "motion-safe:animate-pulse ring-2 ring-[#f0cf83]",
        isRedSuit(card.suit) && "text-[#b2333f]",
      )}
      style={{ transitionDelay: `${index * 70}ms` }}
    >
      {rankText(card.rank)}
      {suitText(card.suit)}
    </span>
  )
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

function RuleCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-black text-[#f4d18a]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#d9ceb0]">{body}</p>
    </div>
  )
}
