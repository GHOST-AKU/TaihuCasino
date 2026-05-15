"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  BookOpen,
  Martini,
  RotateCcw,
  Settings,
  Trash2,
} from "lucide-react"

import { useLanguage } from "@/hooks/use-language"
import { type Language } from "@/lib/home-content"
import { type CasinoTableEntry } from "@/lib/game-catalog"
import { type MemberGameProgress, type MemberTableSession } from "@/lib/member-data"
import { recordClientGameRound } from "@/lib/member-round-client"
import { cashOutClientTableSession, openClientTableSession } from "@/lib/table-session-client"
import { cn } from "@/lib/utils"

type Suit = "spades" | "hearts" | "diamonds" | "clubs"
type Phase = "idle" | "insurance" | "player" | "dealer" | "done"
type Outcome = "win" | "loss" | "push"

interface BlackjackCard {
  rank: number
  suit: Suit
}

interface BlackjackHand {
  id: string
  label: string
  cards: BlackjackCard[]
  bet: number
  finished: boolean
  busted: boolean
  doubled: boolean
  fromSplit: boolean
  naturalBlackjack: boolean
  resultLabel?: string
}

interface BlackjackStats {
  rounds: number
  wins: number
  blackjacks: number
  totalStake: number
  totalDelta: number
  lastDelta: number
  history: Array<{
    id: string
    code: string
    detail: string
    delta: number
  }>
}

const suits = ["spades", "hearts", "diamonds", "clubs"] satisfies Suit[]
const defaultChips = [10, 25, 50, 100, 250]

function initialStats(): BlackjackStats {
  return {
    rounds: 0,
    wins: 0,
    blackjacks: 0,
    totalStake: 0,
    totalDelta: 0,
    lastDelta: 0,
    history: [],
  }
}

function statsFromProgress(progress: MemberGameProgress | null): BlackjackStats {
  const stats = initialStats()

  if (!progress) {
    return stats
  }

  return {
    ...stats,
    rounds: progress.plays,
    wins: progress.wins,
    totalDelta: progress.lastDelta,
    lastDelta: progress.lastDelta,
  }
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

function shuffleCards(cards: BlackjackCard[]) {
  const next = [...cards]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = next[index]
    next[index] = next[swapIndex]
    next[swapIndex] = current
  }

  return next
}

function freshDeck() {
  const cards: BlackjackCard[] = []

  for (const suit of suits) {
    for (let rank = 1; rank <= 13; rank += 1) {
      cards.push({ rank, suit })
    }
  }

  return shuffleCards(cards)
}

function drawFrom(deck: BlackjackCard[]) {
  if (deck.length < 12) {
    deck.splice(0, deck.length, ...freshDeck())
  }

  const card = deck.pop()

  if (!card) {
    throw new Error("Deck could not draw a card.")
  }

  return card
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

function cardValue(card: BlackjackCard) {
  if (card.rank === 1) {
    return 11
  }

  return Math.min(card.rank, 10)
}

function handTotal(cards: BlackjackCard[]) {
  let total = cards.reduce((sum, card) => sum + cardValue(card), 0)
  let aces = cards.filter((card) => card.rank === 1).length

  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }

  return total
}

function isSoftTotal(cards: BlackjackCard[], target: number) {
  let total = cards.reduce((sum, card) => sum + cardValue(card), 0)
  let aces = cards.filter((card) => card.rank === 1).length
  let reduced = false

  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
    reduced = true
  }

  return total === target && cards.some((card) => card.rank === 1) && !reduced
}

function isBlackjack(cards: BlackjackCard[]) {
  return cards.length === 2 && handTotal(cards) === 21
}

function splitValue(card: BlackjackCard) {
  return card.rank >= 10 ? 10 : card.rank
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

function totalCommittedStake(hands: BlackjackHand[], insuranceBet: number) {
  return hands.reduce((sum, hand) => sum + hand.bet, 0) + insuranceBet
}

function createHand(
  label: string,
  bet: number,
  cards: BlackjackCard[],
  fromSplit = false,
): BlackjackHand {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label,
    cards,
    bet,
    finished: false,
    busted: false,
    doubled: false,
    fromSplit,
    naturalBlackjack: !fromSplit && isBlackjack(cards),
  }
}

function settleHands({
  balance,
  dealerCards,
  hands,
  insuranceBet,
  stats,
  language,
}: {
  balance: number
  dealerCards: BlackjackCard[]
  hands: BlackjackHand[]
  insuranceBet: number
  stats: BlackjackStats
  language: Language
}) {
  const dealerTotal = handTotal(dealerCards)
  const dealerBlackjack = isBlackjack(dealerCards)
  let nextBalance = balance
  let roundDelta = 0
  let handWins = 0
  let blackjacks = 0
  const settledHands = hands.map((hand) => {
    const playerTotal = handTotal(hand.cards)
    let payout = 0
    let resultLabel = ""
    let code = "T"

    if (hand.busted || playerTotal > 21) {
      resultLabel = language === "zh" ? `爆牌，输掉 ${formatMoney(hand.bet)}` : `Bust, lost ${formatMoney(hand.bet)}`
      code = "D"
    } else if (dealerBlackjack) {
      if (hand.naturalBlackjack) {
        payout = hand.bet
        resultLabel = language === "zh" ? "与庄家同为黑杰克，主注退回" : "Both blackjack, main bet returned"
        code = "T"
      } else {
        resultLabel = language === "zh" ? `庄家黑杰克，输掉 ${formatMoney(hand.bet)}` : `Dealer blackjack, lost ${formatMoney(hand.bet)}`
        code = "DB"
      }
    } else if (hand.naturalBlackjack) {
      payout = hand.bet * 2.5
      resultLabel = language === "zh" ? `自然黑杰克，净赢 ${formatMoney(hand.bet * 1.5)}` : `Natural blackjack, net ${formatMoney(hand.bet * 1.5)}`
      code = "PB"
      handWins += 1
      blackjacks += 1
    } else if (dealerTotal > 21 || playerTotal > dealerTotal) {
      payout = hand.bet * 2
      resultLabel = language === "zh" ? `胜出，净赢 ${formatMoney(hand.bet)}` : `Won, net ${formatMoney(hand.bet)}`
      code = "P"
      handWins += 1
    } else if (playerTotal < dealerTotal) {
      resultLabel = language === "zh" ? `落后于庄家，输掉 ${formatMoney(hand.bet)}` : `Behind dealer, lost ${formatMoney(hand.bet)}`
      code = "D"
    } else {
      payout = hand.bet
      resultLabel = language === "zh" ? "平局，主注退回" : "Push, main bet returned"
      code = "T"
    }

    nextBalance += payout
    roundDelta += payout - hand.bet

    return {
      ...hand,
      finished: true,
      busted: hand.busted || playerTotal > 21,
      resultLabel,
      code,
    }
  })

  let insuranceText = language === "zh" ? "未购买保险" : "No insurance"

  if (insuranceBet > 0) {
    if (dealerBlackjack) {
      nextBalance += insuranceBet * 3
      roundDelta += insuranceBet * 2
      insuranceText = language === "zh" ? `保险净赢 ${formatMoney(insuranceBet * 2)}` : `Insurance net ${formatMoney(insuranceBet * 2)}`
    } else {
      roundDelta -= insuranceBet
      insuranceText = language === "zh" ? `保险输掉 ${formatMoney(insuranceBet)}` : `Insurance lost ${formatMoney(insuranceBet)}`
    }
  }

  const summary = settledHands.map((hand) => hand.resultLabel).join(language === "zh" ? "；" : "; ")
  const detail = `${summary}${insuranceBet > 0 ? `；${insuranceText}` : ""}`
  const nextStats: BlackjackStats = {
    rounds: stats.rounds + 1,
    wins: stats.wins + handWins,
    blackjacks: stats.blackjacks + blackjacks,
    totalStake: stats.totalStake + totalCommittedStake(hands, insuranceBet),
    totalDelta: stats.totalDelta + roundDelta,
    lastDelta: roundDelta,
    history: [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        code: settledHands.find((hand) => hand.code === "PB")?.code ?? settledHands[0]?.code ?? "T",
        detail,
        delta: roundDelta,
      },
      ...stats.history,
    ].slice(0, 20),
  }
  const totalStake = totalCommittedStake(hands, insuranceBet)

  return {
    balance: nextBalance,
    hands: settledHands,
    stats: nextStats,
    message:
      language === "zh"
        ? `${detail}。本轮 ${formatDelta(roundDelta)}。`
        : `${detail}. Round ${formatDelta(roundDelta)}.`,
    roundDelta,
    totalStake,
  }
}

async function persistBlackjackProgress(
  entry: CasinoTableEntry,
  delta: number,
  bankroll: number,
  summary: string,
  totalStake: number,
  hands: BlackjackHand[],
  dealerCards: BlackjackCard[],
  insuranceBet: number,
  idempotencyKey: string,
  tableSessionId?: string,
) {
  return recordClientGameRound({
    gameSlug: entry.slug,
    outcome: delta > 0 ? "win" : delta < 0 ? "loss" : "push",
    delta,
    bankroll,
    summary,
    idempotencyKey,
    tableSessionId,
    totalStake,
    betSnapshot: {
      hands: hands.map((hand) => ({
        label: hand.label,
        bet: hand.bet,
        doubled: hand.doubled,
        fromSplit: hand.fromSplit,
      })),
      insuranceBet,
      totalStake,
    },
    resultSnapshot: {
      dealerCards,
      hands: hands.map((hand) => ({
        label: hand.label,
        cards: hand.cards,
        resultLabel: hand.resultLabel,
        busted: hand.busted,
        naturalBlackjack: hand.naturalBlackjack,
      })),
    },
  })
}

export function BlackjackTablePage({
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
  const buyInWalletLabel = isChinese ? "主钱包余额" : "Main wallet"
  const tableChipsLabel = isChinese ? "桌台筹码（随输赢变化）" : "Table chips (changes each hand)"
  const mainWalletNote = isChinese ? "主钱包（买入/离桌时变化）" : "Main wallet (buy-in/cash-out only)"
  const buyInHint = isChinese
    ? "主钱包只在买入和离桌时变化；每手牌输赢会先结算到本桌筹码。"
    : "Your wallet changes on buy-in and cash-out. Each hand settles into table chips first."
  const initialBankroll = initialTableSession?.chipBalance ?? 0
  const [bankroll, setBankroll] = useState(initialBankroll)
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance)
  const [tableSession, setTableSession] = useState<MemberTableSession | null>(initialTableSession)
  const [buyInAmount, setBuyInAmount] = useState(100)
  const [isOpeningSession, setIsOpeningSession] = useState(false)
  const [isCashingOut, setIsCashingOut] = useState(false)
  const [isSyncingRound, setIsSyncingRound] = useState(false)
  const [stake, setStake] = useState(50)
  const [chips, setChips] = useState(defaultChips)
  const [initialBankrollInput, setInitialBankrollInput] = useState(String(initialBankroll))
  const [initialChipsInput, setInitialChipsInput] = useState(defaultChips.join(","))
  const [deck, setDeck] = useState<BlackjackCard[]>(() => freshDeck())
  const [dealerCards, setDealerCards] = useState<BlackjackCard[]>([])
  const [hands, setHands] = useState<BlackjackHand[]>([])
  const [activeHandIndex, setActiveHandIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>("idle")
  const [revealDealer, setRevealDealer] = useState(true)
  const [insuranceBet, setInsuranceBet] = useState(0)
  const [message, setMessage] = useState(
    isChinese
      ? "先设置主注，再点击发牌开局。"
      : "Set the main bet, then deal a new hand.",
  )
  const [stats, setStats] = useState<BlackjackStats>(() => statsFromProgress(initialProgress))
  const [showRules, setShowRules] = useState(false)
  const [dealing, setDealing] = useState(false)
  const storageKey = `taihu-blackjack-table-${entry.slug}`
  const activeHand = hands[activeHandIndex]
  const currentStake = phase === "idle" || phase === "done" ? stake : totalCommittedStake(hands, insuranceBet)
  const roi = stats.totalStake > 0 ? (stats.totalDelta / stats.totalStake) * 100 : 0
  const phaseInfo = useMemo(() => {
    if (phase === "insurance") {
      return {
        title: isChinese ? "保险决策" : "Insurance",
        detail: isChinese ? "庄家明牌是 A，可以决定是否买保险。" : "Dealer shows an Ace. Choose insurance or skip.",
      }
    }

    if (phase === "player") {
      return {
        title: isChinese ? "玩家回合" : "Player turn",
        detail: isChinese ? "按高亮手牌依次操作。" : "Act on the highlighted hand.",
      }
    }

    if (phase === "dealer") {
      return {
        title: isChinese ? "庄家补牌" : "Dealer draw",
        detail: isChinese ? "庄家翻开暗牌并补牌到 17 点或以上。" : "Dealer reveals and draws to 17 or more.",
      }
    }

    if (phase === "done") {
      return {
        title: isChinese ? "本局结束" : "Round done",
        detail: isChinese ? "可以直接开下一手。" : "Ready for another hand.",
      }
    }

    return {
      title: isChinese ? "等待开局" : "Idle",
      detail: isChinese ? "未开始新的一手。" : "No active hand.",
    }
  }, [isChinese, phase])

  useEffect(() => {
    if (!initialTableSession) {
      window.localStorage.removeItem(storageKey)
      setWalletBalance(initialWalletBalance)
      setTableSession(null)
      setBankroll(0)
      setInitialBankrollInput("0")
      setDealerCards([])
      setHands([])
      setActiveHandIndex(0)
      setPhase("idle")
      setRevealDealer(true)
      setInsuranceBet(0)
      setDealing(false)

      if (initialProgress) {
        setStats(statsFromProgress(initialProgress))
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
          stats?: BlackjackStats
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
      setStats(statsFromProgress(initialProgress))
    }
  }, [storageKey, initialProgress, initialWalletBalance, initialTableSession])

  function persistLocal(nextBankroll: number, nextStats: BlackjackStats) {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        bankroll: nextBankroll,
        stake,
        chips,
        stats: nextStats,
      }),
    )
  }

  async function openSession() {
    const amount = Math.min(1000000, Math.max(1, Math.round(Number(buyInAmount) * 100) / 100))

    if (amount > walletBalance) {
      setMessage(isChinese ? "钱包余额不足，无法买入这笔筹码。" : "Wallet balance is not enough for this buy-in.")
      return
    }

    setIsOpeningSession(true)
    setMessage(isChinese ? "正在从钱包买入桌台筹码..." : "Buying chips from your wallet...")

    try {
      const result = await openClientTableSession(entry.slug, amount, "blackjack-buy-in")

      setTableSession(result.tableSession)
      setBankroll(result.tableSession.chipBalance)
      setInitialBankrollInput(String(result.tableSession.chipBalance))
      setWalletBalance(result.walletBalance ?? walletBalance - amount)
      setDealerCards([])
      setHands([])
      setPhase("idle")
      setInsuranceBet(0)
      window.localStorage.removeItem(storageKey)
      setMessage(isChinese ? "买入成功，桌台筹码已准备好。" : "Buy-in complete. Table chips are ready.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "买入失败。" : "Buy-in failed.")
    } finally {
      setIsOpeningSession(false)
    }
  }

  async function cashOutSession() {
    if (!tableSession || isCashingOut || dealing || (phase !== "idle" && phase !== "done")) {
      return
    }

    setIsCashingOut(true)
    setMessage(isChinese ? "正在带走筹码并结算回钱包..." : "Cashing out table chips to your wallet...")

    try {
      const result = await cashOutClientTableSession(tableSession.id, "blackjack-cash-out", tableSession.chipBalance)

      setTableSession(null)
      setBankroll(0)
      setInitialBankrollInput("0")
      setWalletBalance(result.walletBalance ?? walletBalance + tableSession.chipBalance)
      setDealerCards([])
      setHands([])
      setPhase("idle")
      setInsuranceBet(0)
      window.localStorage.removeItem(storageKey)
      setMessage(isChinese ? "筹码已带走，余额已回到钱包。" : "Chips cashed out. Balance returned to wallet.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "离桌失败。" : "Cash-out failed.")
    } finally {
      setIsCashingOut(false)
    }
  }

  function finishRound(
    currentBalance: number,
    currentDealer: BlackjackCard[],
    currentHands: BlackjackHand[],
    currentInsuranceBet: number,
    currentStats: BlackjackStats,
  ) {
    const activeTableSession = tableSession

    if (!activeTableSession) {
      setMessage(isChinese ? "请先从钱包买入筹码再入桌。" : "Buy in from your wallet before playing this table.")
      return
    }

    const settled = settleHands({
      balance: currentBalance,
      dealerCards: currentDealer,
      hands: currentHands,
      insuranceBet: currentInsuranceBet,
      stats: currentStats,
      language,
    })

    setBankroll(settled.balance)
    setTableSession({ ...activeTableSession, chipBalance: settled.balance })
    setHands(settled.hands)
    setDealerCards(currentDealer)
    setRevealDealer(true)
    setInsuranceBet(currentInsuranceBet)
    setStats(settled.stats)
    setPhase("done")
    setMessage(settled.message)
    persistLocal(settled.balance, settled.stats)
    setIsSyncingRound(true)
    void (async () => {
      try {
        const serverBankroll = await persistBlackjackProgress(
          entry,
          settled.roundDelta,
          settled.balance,
          settled.message,
          settled.totalStake,
          settled.hands,
          currentDealer,
          currentInsuranceBet,
          `blackjack-${entry.slug}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          activeTableSession.id,
        )

        if (typeof serverBankroll === "number") {
          setBankroll(serverBankroll)
          setTableSession((current) => current ? { ...current, chipBalance: serverBankroll } : current)
          persistLocal(serverBankroll, settled.stats)
        }
      } catch (error) {
        console.error("blackjack round sync failed", error)
      } finally {
        setIsSyncingRound(false)
        setPhase("done")
      }
    })()
  }

  function dealerPlay(
    currentBalance: number,
    currentDeck: BlackjackCard[],
    currentHands: BlackjackHand[],
    currentDealer: BlackjackCard[],
    currentInsuranceBet = insuranceBet,
  ) {
    const deckCopy = [...currentDeck]
    const finalDealer = [...currentDealer]
    const allBusted = currentHands.every((hand) => hand.busted || handTotal(hand.cards) > 21)

    if (!allBusted) {
      while (handTotal(finalDealer) < 17 || (handTotal(finalDealer) === 17 && isSoftTotal(finalDealer, 17) && false)) {
        finalDealer.push(drawFrom(deckCopy))
      }
    }

    setDeck(deckCopy)
    finishRound(currentBalance, finalDealer, currentHands, currentInsuranceBet, stats)
  }

  function advanceHandOrDealer(
    currentBalance: number,
    currentDeck: BlackjackCard[],
    currentHands: BlackjackHand[],
    currentDealer = dealerCards,
  ) {
    const nextIndex = currentHands.findIndex((hand, index) => index > activeHandIndex && !hand.finished)

    if (nextIndex >= 0) {
      setBankroll(currentBalance)
      setDeck(currentDeck)
      setHands(currentHands)
      setActiveHandIndex(nextIndex)
      setPhase("player")
      setMessage(
        isChinese
          ? `轮到 ${currentHands[nextIndex].label}。`
          : `${currentHands[nextIndex].label} is active.`,
      )
      return
    }

    setPhase("dealer")
    setRevealDealer(true)
    setMessage(isChinese ? "玩家操作完成，庄家开始补牌。" : "Player actions complete. Dealer draws.")
    dealerPlay(currentBalance, currentDeck, currentHands, currentDealer)
  }

  function deal() {
    if (dealing || (phase !== "idle" && phase !== "done")) {
      return
    }

    if (!tableSession) {
      setMessage(isChinese ? "请先从钱包买入筹码再入桌。" : "Buy in from your wallet before playing this table.")
      return
    }

    const baseStake = clampInt(stake, 0)

    if (baseStake <= 0) {
      setMessage(isChinese ? "请先设置大于 0 的主注。" : "Set a main bet above 0 first.")
      return
    }

    if (bankroll < baseStake) {
      setMessage(
        isChinese
          ? `余额不足：主注 ${formatMoney(baseStake)}，当前余额 ${formatMoney(bankroll)}。`
          : `Insufficient bankroll: bet ${formatMoney(baseStake)}, bankroll ${formatMoney(bankroll)}.`,
      )
      return
    }

    setDealing(true)
    setMessage(isChinese ? "阶段发牌中..." : "Dealing...")

    window.setTimeout(() => {
      const nextDeck = deck.length < 12 ? freshDeck() : [...deck]
      const playerFirst = drawFrom(nextDeck)
      const dealerFirst = drawFrom(nextDeck)
      const playerSecond = drawFrom(nextDeck)
      const dealerSecond = drawFrom(nextDeck)
      const nextDealer = [dealerFirst, dealerSecond]
      const nextHands = [createHand(isChinese ? "玩家主手" : "Main hand", baseStake, [playerFirst, playerSecond])]
      const nextBalance = bankroll - baseStake
      const dealerBlackjack = isBlackjack(nextDealer)
      const playerBlackjack = nextHands[0].naturalBlackjack

      setDeck(nextDeck)
      setBankroll(nextBalance)
      setDealerCards(nextDealer)
      setHands(nextHands)
      setActiveHandIndex(0)
      setRevealDealer(false)
      setInsuranceBet(0)
      setDealing(false)

      if (dealerFirst.rank === 1) {
        setPhase("insurance")
        setMessage(
          isChinese
            ? `庄家明牌是 A，可以选择是否购买保险。保险金额固定为 ${formatMoney(baseStake / 2)}。`
            : `Dealer shows Ace. Insurance is ${formatMoney(baseStake / 2)}.`,
        )
        return
      }

      if (dealerBlackjack || playerBlackjack) {
        finishRound(nextBalance, nextDealer, nextHands, 0, stats)
        return
      }

      setPhase("player")
      setMessage(isChinese ? "发牌完成。现在进入玩家回合。" : "Deal complete. Player turn.")
    }, 420)
  }

  function continueAfterPeek(nextBalance: number, nextInsuranceBet: number) {
    const dealerBlackjack = isBlackjack(dealerCards)

    if (dealerBlackjack || hands[0]?.naturalBlackjack) {
      finishRound(nextBalance, dealerCards, hands, nextInsuranceBet, stats)
      return
    }

    setBankroll(nextBalance)
    setInsuranceBet(nextInsuranceBet)
    setPhase("player")
    setRevealDealer(false)
    setMessage(isChinese ? "庄家不是黑杰克。现在进入玩家回合。" : "Dealer is not blackjack. Player turn.")
  }

  function buyInsurance() {
    if (phase !== "insurance" || !hands[0]) {
      return
    }

    const amount = hands[0].bet / 2

    if (bankroll < amount) {
      setMessage(isChinese ? "余额不足，无法购买保险。" : "Insufficient bankroll for insurance.")
      return
    }

    setMessage(isChinese ? `已购买保险 ${formatMoney(amount)}。` : `Insurance bought for ${formatMoney(amount)}.`)
    continueAfterPeek(bankroll - amount, amount)
  }

  function skipInsurance() {
    if (phase !== "insurance") {
      return
    }

    setMessage(isChinese ? "已跳过保险，庄家查看暗牌。" : "Insurance skipped. Dealer peeks.")
    continueAfterPeek(bankroll, 0)
  }

  function hit() {
    if (phase !== "player" || !activeHand) {
      return
    }

    const nextDeck = [...deck]
    const nextHands = hands.map((hand, index) => {
      if (index !== activeHandIndex) {
        return hand
      }

      const cards = [...hand.cards, drawFrom(nextDeck)]
      const total = handTotal(cards)

      return {
        ...hand,
        cards,
        finished: total >= 21,
        busted: total > 21,
        resultLabel:
          total > 21
            ? isChinese
              ? `爆牌（${total}）`
              : `Bust (${total})`
            : total === 21
              ? isChinese
                ? "21 点，自动停牌"
                : "21, auto stand"
              : hand.resultLabel,
      }
    })
    const nextHand = nextHands[activeHandIndex]

    if (nextHand.finished) {
      advanceHandOrDealer(bankroll, nextDeck, nextHands)
      return
    }

    setDeck(nextDeck)
    setHands(nextHands)
    setMessage(
      isChinese
        ? `${nextHand.label} 当前 ${handTotal(nextHand.cards)} 点。`
        : `${nextHand.label} now has ${handTotal(nextHand.cards)}.`,
    )
  }

  function stand() {
    if (phase !== "player" || !activeHand) {
      return
    }

    const nextHands = hands.map((hand, index) =>
      index === activeHandIndex
        ? {
            ...hand,
            finished: true,
            resultLabel: isChinese ? "主动停牌" : "Stood",
          }
        : hand,
    )

    advanceHandOrDealer(bankroll, deck, nextHands)
  }

  function doubleDown() {
    if (!canDouble) {
      return
    }

    const nextDeck = [...deck]
    const nextBalance = bankroll - activeHand.bet
    const nextHands = hands.map((hand, index) => {
      if (index !== activeHandIndex) {
        return hand
      }

      const cards = [...hand.cards, drawFrom(nextDeck)]
      const total = handTotal(cards)

      return {
        ...hand,
        cards,
        bet: hand.bet * 2,
        doubled: true,
        finished: true,
        busted: total > 21,
        resultLabel:
          total > 21
            ? isChinese
              ? `双倍后爆牌（${total}）`
              : `Doubled and bust (${total})`
            : isChinese
              ? `双倍后停牌（${total}）`
              : `Doubled and stood (${total})`,
      }
    })

    advanceHandOrDealer(nextBalance, nextDeck, nextHands)
  }

  function split() {
    if (!canSplit) {
      return
    }

    const [firstCard, secondCard] = activeHand.cards
    const nextDeck = [...deck]
    const firstHand = createHand(isChinese ? "玩家手 1" : "Hand 1", activeHand.bet, [firstCard, drawFrom(nextDeck)], true)
    const secondHand = createHand(isChinese ? "玩家手 2" : "Hand 2", activeHand.bet, [secondCard, drawFrom(nextDeck)], true)

    setBankroll(bankroll - activeHand.bet)
    setDeck(nextDeck)
    setHands([firstHand, secondHand])
    setActiveHandIndex(0)
    setPhase("player")
    setMessage(isChinese ? "已完成分牌。现在从玩家手 1 开始。" : "Split complete. Start with Hand 1.")
  }

  function clearBet() {
    if (phase !== "idle" && phase !== "done") {
      return
    }

    setStake(0)
    setMessage(isChinese ? "已清空基础主注。" : "Main bet cleared.")
  }

  function resetTable() {
    const nextBankroll = tableSession?.chipBalance ?? 0

    setBankroll(nextBankroll)
    setInitialBankrollInput(String(nextBankroll))
    setStake(50)
    setChips(defaultChips)
    setInitialChipsInput(defaultChips.join(","))
    setDeck(freshDeck())
    setDealerCards([])
    setHands([])
    setActiveHandIndex(0)
    setPhase("idle")
    setRevealDealer(true)
    setInsuranceBet(0)
    setStats(initialStats())
    window.localStorage.removeItem(storageKey)
    setMessage(isChinese ? "已重置局面。现在等待开局。" : "Table reset. Ready to deal.")
  }

  function applyInitialSettings() {
    if (phase !== "idle" && phase !== "done") {
      return
    }

    const nextBankroll = tableSession?.chipBalance ?? 0
    const nextChips = parseChips(initialChipsInput, defaultChips)

    setBankroll(nextBankroll)
    setChips(nextChips)
    setStake(nextChips[0])
    setDeck(freshDeck())
    setDealerCards([])
    setHands([])
    setActiveHandIndex(0)
    setPhase("idle")
    setRevealDealer(true)
    setInsuranceBet(0)
    setStats(initialStats())
    window.localStorage.removeItem(storageKey)
    setMessage(isChinese ? "已应用初始设置，统计与牌局一并重置。" : "Initial settings applied; table and stats reset.")
  }

  const canHit = phase === "player" && Boolean(activeHand) && !activeHand.finished
  const canStand = canHit
  const canDouble =
    canHit &&
    activeHand.cards.length === 2 &&
    bankroll >= activeHand.bet
  const canSplit =
    canHit &&
    hands.length === 1 &&
    activeHand.cards.length === 2 &&
    splitValue(activeHand.cards[0]) === splitValue(activeHand.cards[1]) &&
    bankroll >= activeHand.bet
  const canBuyInsurance = phase === "insurance" && Boolean(hands[0]) && bankroll >= hands[0].bet / 2

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
                {isChinese ? "21 点实桌" : "Blackjack table"}
              </p>
              <h1 className="text-2xl font-black tracking-normal text-[#fff4d8] md:text-4xl">
                {isChinese ? entry.titleZh : entry.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/games/cocktail-service"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#214a35]"
            >
              <Martini className="size-4" />
              {isChinese ? "去酒吧点饮料" : "Order drink"}
            </Link>
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
              onClick={clearBet}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#214a35]"
            >
              <Trash2 className="size-4" />
              {isChinese ? "清空主注" : "Clear bet"}
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
                  <label htmlFor="blackjackBuyInAmount" className="text-sm font-black text-[#fff4d8]">
                    {isChinese ? "买入金额" : "Buy-in amount"}
                  </label>
                  <input
                    id="blackjackBuyInAmount"
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
                  {isChinese ? "资金与操作" : "Bankroll & Actions"}
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
                  disabled={isCashingOut || isSyncingRound || dealing || (phase !== "idle" && phase !== "done")}
                  className="inline-flex min-h-12 items-center rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#214a35] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isCashingOut ? (isChinese ? "离桌中..." : "Cashing out...") : isChinese ? "带走筹码" : "Cash out"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={deal}
                disabled={dealing || !tableSession || (phase !== "idle" && phase !== "done")}
                className="inline-flex min-h-12 items-center rounded-lg border border-[#d0b06e]/50 bg-gradient-to-b from-[#f0cf83] to-[#c69d55] px-5 text-base font-black text-[#34240a] shadow-[0_14px_28px_rgba(0,0,0,0.26)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {dealing ? (isChinese ? "发牌中" : "Dealing") : isChinese ? "发牌开局" : "Deal"}
              </button>
            </div>

            <p className="mt-4 min-h-12 text-sm leading-6 text-[#cbbd91]">{message}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full border border-white/10 bg-black/25">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r from-transparent via-[#f0cf83] to-transparent transition-all duration-500",
                  dealing ? "w-full" : "w-0",
                )}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniStat label={isChinese ? "当前阶段" : "Phase"} value={phaseInfo.title} detail={phaseInfo.detail} />
              <MiniStat
                label={isChinese ? "当前行动位" : "Active hand"}
                value={activeHand?.label ?? (isChinese ? "玩家主手" : "Main hand")}
                detail={activeHand ? `${handTotal(activeHand.cards)} ${isChinese ? "点" : "points"}` : isChinese ? "开局后会标记正在操作的手牌。" : "The active hand appears after deal."}
              />
              <MiniStat
                label={isChinese ? "保险 / 额外投注" : "Insurance"}
                value={insuranceBet > 0 ? formatMoney(insuranceBet) : phase === "insurance" ? (isChinese ? "可购买" : "Available") : isChinese ? "无" : "None"}
                detail={isChinese ? "庄家明牌 A 时可以购买保险。" : "Insurance opens when dealer shows Ace."}
              />
            </div>
          </div>

          <div className="rounded-lg border border-[#d0b06e]/30 bg-black/25 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
              {isChinese ? "桌面操作区" : "Table controls"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              <ActionButton disabled={!canHit} onClick={hit} label={isChinese ? "要牌 Hit" : "Hit"} />
              <ActionButton disabled={!canStand} onClick={stand} label={isChinese ? "停牌 Stand" : "Stand"} />
              <ActionButton disabled={!canDouble} onClick={doubleDown} label={isChinese ? "双倍 Double" : "Double"} />
              <ActionButton disabled={!canSplit} onClick={split} label={isChinese ? "分牌 Split" : "Split"} />
              <ActionButton disabled={!canBuyInsurance} onClick={buyInsurance} label={isChinese ? "保险 Insurance" : "Insurance"} />
              <ActionButton disabled={phase !== "insurance"} onClick={skipInsurance} label={isChinese ? "跳过保险" : "Skip insurance"} ghost />
            </div>
            <p className="mt-4 text-xs leading-5 text-[#cbbd91]">
              {isChinese
                ? "默认使用单副牌、标准主注、S17。当前版本支持一次分牌，不支持再分牌、投降和边注。"
                : "Single-deck, standard main bet, S17. One split is supported; no surrender or side bets."}
            </p>
          </div>
        </section>

        <section className="grid items-start gap-3 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg border border-[#d0b06e]/30 bg-black/20 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
              {isChinese ? "庄家区域" : "Dealer"}
            </p>
            <div className="mt-2">
              <HandPanel
                hand={{
                  id: "dealer",
                  label: isChinese ? "庄家 Dealer" : "Dealer",
                  cards: dealerCards,
                  bet: 0,
                  finished: true,
                  busted: false,
                  doubled: false,
                  fromSplit: false,
                  naturalBlackjack: revealDealer && isBlackjack(dealerCards),
                }}
                active={false}
                hidden={!revealDealer}
                badge={revealDealer ? `${handTotal(dealerCards)} ${isChinese ? "点" : "points"}` : dealerCards[0] ? `${cardValue(dealerCards[0])} + ?` : "0"}
              />
            </div>
          </div>

          <div className="rounded-lg border border-[#d0b06e]/30 bg-black/20 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
              {isChinese ? "玩家区域" : "Player hands"}
            </p>
            <div className="mt-2 grid gap-2">
              {hands.length > 0 ? (
                hands.map((hand, index) => (
                  <HandPanel
                    key={hand.id}
                    hand={hand}
                    active={phase === "player" && index === activeHandIndex}
                    badge={`${handTotal(hand.cards)} ${isChinese ? "点" : "points"}`}
                  />
                ))
              ) : (
                <div className="rounded-lg border border-[#d0b06e]/30 bg-black/20 p-3 text-sm text-[#cbbd91]">
                  {isChinese ? "尚未开始本局。" : "No hand has started."}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-lg border border-[#d0b06e]/30 bg-black/20 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
              {isChinese ? "主注与筹码" : "Main bet & chips"}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label htmlFor="blackjackStakeInput" className="text-sm font-black text-[#fff4d8]">
                {isChinese ? "当前基础主注金额" : "Base main bet"}
              </label>
              <input
                id="blackjackStakeInput"
                type="number"
                min={0}
                step={1}
                value={stake}
                disabled={phase !== "idle" && phase !== "done"}
                onChange={(event) => setStake(clampInt(event.target.value, 0))}
                className="h-10 w-32 rounded-lg border border-[#d0b06e]/35 bg-black/25 px-3 text-base font-black text-[#fff4d8] outline-none transition focus:border-[#f0cf83] disabled:opacity-50"
              />
              <p className="text-sm text-[#cbbd91]">
                {isChinese ? "双倍下注会把当前手的主注翻倍，分牌会复制同额主注。" : "Double adds the same amount; split duplicates the hand bet."}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((chip, index) => (
                <button
                  key={chip}
                  type="button"
                  disabled={phase !== "idle" && phase !== "done"}
                  onClick={() => setStake(chip)}
                  className={cn(
                    "min-h-12 min-w-20 rounded-full border-2 border-dashed border-white/45 px-4 text-base font-black text-white shadow-[inset_0_2px_10px_rgba(255,255,255,0.25),0_8px_16px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 disabled:opacity-50",
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
              <label htmlFor="blackjackInitialBankroll" className="text-sm font-black text-[#fff4d8]">
                {isChinese ? "初始资金" : "Initial bankroll"}
              </label>
              <input
                id="blackjackInitialBankroll"
                type="number"
                min={100}
                step={100}
                value={initialBankrollInput}
                disabled
                onChange={(event) => setInitialBankrollInput(event.target.value)}
                className="h-10 w-36 rounded-lg border border-[#d0b06e]/35 bg-black/25 px-3 text-base font-black text-[#fff4d8] outline-none transition focus:border-[#f0cf83] disabled:opacity-50"
              />
              <label htmlFor="blackjackInitialChips" className="text-sm font-black text-[#fff4d8]">
                {isChinese ? "筹码面额" : "Chip values"}
              </label>
              <input
                id="blackjackInitialChips"
                type="text"
                value={initialChipsInput}
                disabled={phase !== "idle" && phase !== "done"}
                onChange={(event) => setInitialChipsInput(event.target.value)}
                className="h-10 w-64 rounded-lg border border-[#d0b06e]/35 bg-black/25 px-3 text-base font-black text-[#fff4d8] outline-none transition focus:border-[#f0cf83] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={applyInitialSettings}
                disabled={phase !== "idle" && phase !== "done"}
                className="h-10 rounded-lg border border-[#d0b06e]/35 bg-[#234b33] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#2d5b40] disabled:opacity-50"
              >
                {isChinese ? "应用初始设置" : "Apply settings"}
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-[#d0b06e]/25">
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-white/10 px-4 py-3 text-sm last:border-b-0">
                <span className="font-black text-[#fff4d8]">{isChinese ? "基础主注" : "Base bet"}</span>
                <span className="text-[#cbbd91]">{phase === "idle" || phase === "done" ? isChinese ? "等待开局" : "Ready" : isChinese ? "本局锁定" : "Locked"}</span>
                <span className="font-black text-[#f4d18a]">{formatMoney(currentStake)}</span>
              </div>
            </div>
          </div>

          <aside className="rounded-lg border border-[#d0b06e]/30 bg-black/25 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
              {isChinese ? "统计面板" : "Stats"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label={isChinese ? "当前主注" : "Current stake"} value={formatMoney(currentStake)} />
              <Metric
                label={isChinese ? "本轮盈亏" : "Last delta"}
                value={formatDelta(stats.lastDelta)}
                tone={stats.lastDelta >= 0 ? "good" : "bad"}
              />
              <Metric label={isChinese ? "局数 / 赢局" : "Rounds / wins"} value={`${stats.rounds} / ${stats.wins}`} />
              <Metric
                label={isChinese ? "累计 ROI" : "ROI"}
                value={formatPercent(roi)}
                tone={roi >= 0 ? "good" : "bad"}
              />
              <Metric label={isChinese ? "玩家黑杰克" : "Blackjacks"} value={String(stats.blackjacks)} />
              <Metric
                label={isChinese ? "累计净盈亏" : "Net"}
                value={formatDelta(stats.totalDelta)}
                tone={stats.totalDelta >= 0 ? "good" : "bad"}
              />
            </div>
            <p className="mt-5 text-sm font-black text-[#d0b06e]">
              {isChinese ? "最近 20 局" : "Last 20 rounds"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {stats.history.length > 0 ? (
                stats.history.map((record) => (
                  <span
                    key={record.id}
                    title={record.detail}
                    className={cn(
                      "min-w-10 rounded-full border border-white/20 px-3 py-1 text-center text-xs font-black",
                      record.code === "P" && "bg-[#3159a8]/40 text-white",
                      record.code === "PB" && "bg-[#d0b06e]/35 text-[#fff4d8]",
                      record.code === "D" && "bg-[#b2333f]/40 text-white",
                      record.code === "DB" && "bg-[#684326]/45 text-white",
                      record.code === "T" && "bg-[#1f8a56]/40 text-white",
                    )}
                  >
                    {record.code}
                  </span>
                ))
              ) : (
                <span className="text-sm text-[#cbbd91]">
                  {isChinese ? "这里会显示最近牌局。" : "Recent hands appear here."}
                </span>
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
                {isChinese ? "标准 21 点说明" : "Blackjack rules"}
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
                <tbody>
                  <RuleRow label={isChinese ? "主注" : "Main bet"} note={isChinese ? "每手只有一个基础主注，开局前设定金额。" : "One main bet per hand, set before deal."} />
                  <RuleRow label="Double Down" note={isChinese ? "当前手牌正好两张且余额足够时可用，只补一张牌并自动停牌。" : "Available on two cards; draws one card then stands."} />
                  <RuleRow label="Split" note={isChinese ? "支持一次分牌，同点值两张牌可拆成两手。" : "One split is supported when both cards have the same split value."} />
                  <RuleRow label="Insurance" note={isChinese ? "庄家明牌 A 时开放，金额为基础主注的一半，庄家黑杰克时按 2:1 净赢。" : "Available when dealer shows Ace; costs half the base stake and pays 2:1 net."} />
                  <RuleRow label={isChinese ? "庄家规则" : "Dealer"} note={isChinese ? "庄家补牌到 17 点或以上，本页采用 S17。" : "Dealer draws to 17 or higher; S17."} />
                  <RuleRow label={isChinese ? "黑杰克" : "Blackjack"} note={isChinese ? "原始两张自然 21 按 3:2 结算，分牌后 21 只按普通胜利。" : "Natural blackjack pays 3:2; split 21 is a normal win."} />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function ActionButton({
  label,
  disabled,
  ghost = false,
  onClick,
}: {
  label: string
  disabled: boolean
  ghost?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-lg border border-[#d0b06e]/40 px-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45",
        ghost
          ? "bg-white/5 text-[#fff4d8] hover:bg-white/10"
          : "bg-gradient-to-b from-[#f0cf83] to-[#c69d55] text-[#34240a] hover:brightness-105",
      )}
    >
      {label}
    </button>
  )
}

function MiniStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-h-24 rounded-lg border border-[#d0b06e]/25 bg-black/20 p-3">
      <p className="text-xs font-bold text-[#cbbd91]">{label}</p>
      <p className="mt-2 text-lg font-black text-[#fff4d8]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#cbbd91]">{detail}</p>
    </div>
  )
}

function HandPanel({
  hand,
  active,
  hidden = false,
  badge,
}: {
  hand: BlackjackHand
  active: boolean
  hidden?: boolean
  badge: string
}) {
  const visibleCards = hidden && hand.cards.length > 1 ? [hand.cards[0], null] : hand.cards

  return (
    <div
      className={cn(
        "grid min-h-[132px] grid-rows-[auto_1fr_auto] rounded-lg border border-[#d0b06e]/30 bg-black/20 p-3",
        active && "shadow-[inset_0_0_0_2px_rgba(239,207,140,0.55)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-black text-[#fff4d8]">{hand.label}</p>
        <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-black text-[#f4d18a]">
          {badge}
        </span>
      </div>
      <div className="mt-2 flex min-h-[70px] flex-wrap content-start gap-2">
        {visibleCards.length > 0 ? (
          visibleCards.map((card, index) =>
            card ? (
              <PlayingCard key={`${card.rank}-${card.suit}-${index}`} card={card} />
            ) : (
              <span
                key="hidden"
                className="grid h-[68px] w-12 place-items-center rounded-lg border border-[#d0b06e]/30 bg-gradient-to-b from-[#4a2f13] to-[#2a1a08] text-base font-black text-[#f7ddaf] shadow-[0_8px_14px_rgba(0,0,0,0.22)]"
              >
                ?
              </span>
            ),
          )
        ) : (
          <span className="text-sm text-[#cbbd91]">--</span>
        )}
      </div>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-2 text-xs text-[#cbbd91]">
        {hand.bet > 0 ? <span>{`Bet ${formatMoney(hand.bet)}`}</span> : null}
        {hand.doubled ? <span>Double</span> : null}
        {hand.fromSplit ? <span>Split</span> : null}
        {hand.resultLabel ? <span>{hand.resultLabel}</span> : null}
      </div>
    </div>
  )
}

function PlayingCard({ card }: { card: BlackjackCard }) {
  return (
    <span
      className={cn(
        "grid h-[68px] w-12 place-items-center rounded-lg border border-black/20 bg-gradient-to-b from-[#fff9eb] to-[#ddd1b6] text-base font-black text-[#1d160d] shadow-[0_8px_14px_rgba(0,0,0,0.22)]",
        isRedSuit(card.suit) && "text-[#b2333f]",
      )}
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

function RuleRow({ label, note }: { label: string; note: string }) {
  return (
    <tr>
      <td className="w-40 border border-white/10 p-3 font-black text-[#f4d18a]">{label}</td>
      <td className="border border-white/10 p-3 text-[#d9ceb0]">{note}</td>
    </tr>
  )
}
