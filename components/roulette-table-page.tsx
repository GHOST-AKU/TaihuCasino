"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, BookOpen, RotateCcw, Settings, Trash2 } from "lucide-react"

import { useLanguage } from "@/hooks/use-language"
import { type Language } from "@/lib/home-content"
import { type CasinoTableEntry } from "@/lib/game-catalog"
import { type MemberGameProgress, type MemberTableSession } from "@/lib/member-data"
import { recordClientGameRound } from "@/lib/member-round-client"
import { cashOutClientTableSession, openClientTableSession } from "@/lib/table-session-client"
import { cn } from "@/lib/utils"

interface RouletteBet {
  key: string
  labelZh: string
  labelEn: string
  numbers: number[]
  payout: number
  amount: number
}

interface RouletteStats {
  rounds: number
  hitRounds: number
  totalStake: number
  totalDelta: number
  lastDelta: number
}

const redNumbers = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
])
const wheelOrder = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]
const wheelPocketAngle = (Math.PI * 2) / wheelOrder.length
const ballTrackRadius = 214
const ballPocketRadius = 178
const pointerAngle = -Math.PI / 2

const initialStats: RouletteStats = {
  rounds: 0,
  hitRounds: 0,
  totalStake: 0,
  totalDelta: 0,
  lastDelta: 0,
}

function statsFromProgress(progress: MemberGameProgress | null): RouletteStats {
  if (!progress) {
    return initialStats
  }

  return {
    rounds: progress.plays,
    hitRounds: progress.wins,
    totalStake: 0,
    totalDelta: progress.lastDelta,
    lastDelta: progress.lastDelta,
  }
}

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
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

function numberColor(number: number) {
  if (number === 0) {
    return "green"
  }

  return redNumbers.has(number) ? "red" : "black"
}

function betWins(bet: RouletteBet, result: number) {
  return bet.numbers.includes(result)
}

function payoutOne(bet: RouletteBet, result: number) {
  return betWins(bet, result) ? bet.amount * bet.payout : -bet.amount
}

function totalStake(bets: RouletteBet[]) {
  return bets.reduce((sum, bet) => sum + bet.amount, 0)
}

function calculatePreview(bets: RouletteBet[]) {
  const stake = totalStake(bets)
  const netByNumber = range(0, 36).map((number) =>
    bets.reduce((sum, bet) => sum + payoutOne(bet, number), 0),
  )
  const hitProbability = netByNumber.filter((value) => value > 0).length / 37
  const maxWin = netByNumber.length ? Math.max(...netByNumber) : 0

  return {
    count: bets.length,
    expectedValue: -stake / 37,
    hitProbability,
    maxWin,
    totalStake: stake,
  }
}

function buildInsideOptions() {
  const split: number[][] = []
  const street: number[][] = []
  const corner: number[][] = []
  const sixline: number[][] = []

  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const number = row * 3 + col + 1

      if (col < 2) {
        split.push([number, number + 1])
      }

      if (row < 11) {
        split.push([number, number + 3])
      }
    }

    street.push([row * 3 + 1, row * 3 + 2, row * 3 + 3])
  }

  for (let row = 0; row < 11; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      const number = row * 3 + col + 1
      corner.push([number, number + 1, number + 3, number + 4])
    }
  }

  for (let row = 0; row < 11; row += 1) {
    sixline.push([
      row * 3 + 1,
      row * 3 + 2,
      row * 3 + 3,
      row * 3 + 4,
      row * 3 + 5,
      row * 3 + 6,
    ])
  }

  return { split, street, corner, sixline }
}

function formatNumbers(numbers: number[]) {
  return [...numbers].sort((a, b) => a - b).join("/")
}

function normalizeAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

function normalizePositiveAngle(angle: number) {
  return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
}

function pocketCenterAngle(index: number) {
  return pointerAngle + index * wheelPocketAngle + wheelPocketAngle / 2
}

function wheelAngleForResult(result: number) {
  const index = wheelOrder.indexOf(result)
  return normalizeAngle(pointerAngle - pocketCenterAngle(index))
}

function rouletteResultAtPointer(wheelRotation: number) {
  const wheelLocalAngle = normalizePositiveAngle(pointerAngle - wheelRotation - pointerAngle)
  const index = Math.floor(wheelLocalAngle / wheelPocketAngle) % wheelOrder.length

  return wheelOrder[index]
}

function drawWheel(
  canvas: HTMLCanvasElement | null,
  angle: number,
  ballAngle: number | null,
  ballRadius: number,
  result: number | null,
) {
  if (!canvas) {
    return
  }

  const ctx = canvas.getContext("2d")

  if (!ctx) {
    return
  }

  const width = canvas.width
  const height = canvas.height
  const centerX = width / 2
  const centerY = height / 2
  const outer = 194
  const inner = 138

  ctx.clearRect(0, 0, width, height)
  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate(angle)

  for (let index = 0; index < wheelOrder.length; index += 1) {
    const number = wheelOrder[index]
    const start = -Math.PI / 2 + index * wheelPocketAngle
    const end = start + wheelPocketAngle
    const color = number === 0 ? "#1f8a56" : redNumbers.has(number) ? "#b2333f" : "#14171c"

    ctx.beginPath()
    ctx.moveTo(Math.cos(start) * inner, Math.sin(start) * inner)
    ctx.arc(0, 0, outer, start, end)
    ctx.arc(0, 0, inner, end, start, true)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = "rgba(255,255,255,.12)"
    ctx.stroke()

    const middle = (start + end) / 2
    const textX = Math.cos(middle) * ((outer + inner) / 2)
    const textY = Math.sin(middle) * ((outer + inner) / 2)

    ctx.save()
    ctx.translate(textX, textY)
    ctx.rotate(middle + Math.PI / 2)

    if (middle > Math.PI / 2 || middle < -Math.PI / 2) {
      ctx.rotate(Math.PI)
    }

    ctx.fillStyle = "#f9e9c2"
    ctx.font = "bold 16px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(String(number), 0, 0)
    ctx.restore()
  }

  ctx.beginPath()
  ctx.arc(0, 0, 125, 0, Math.PI * 2)
  ctx.fillStyle = "#0e2d21"
  ctx.fill()
  ctx.strokeStyle = "rgba(208,176,110,.7)"
  ctx.lineWidth = 5
  ctx.stroke()
  ctx.restore()

  ctx.beginPath()
  ctx.arc(centerX, centerY, 26, 0, Math.PI * 2)
  ctx.fillStyle = "#d0b06e"
  ctx.fill()

  if (ballAngle !== null) {
    const x = centerX + Math.cos(ballAngle) * ballRadius
    const y = centerY + Math.sin(ballAngle) * ballRadius

    ctx.beginPath()
    ctx.arc(x + 3, y + 4, 10, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(0,0,0,0.22)"
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, 9, 0, Math.PI * 2)
    ctx.fillStyle = "#fff8eb"
    ctx.fill()
    ctx.strokeStyle = "rgba(31,24,15,0.85)"
    ctx.lineWidth = 2
    ctx.stroke()
  } else if (result !== null) {
    const index = wheelOrder.indexOf(result)
    const markerAngle = pocketCenterAngle(index) + angle
    const x = centerX + Math.cos(markerAngle) * 178
    const y = centerY + Math.sin(markerAngle) * 178

    ctx.beginPath()
    ctx.arc(x, y, 8, 0, Math.PI * 2)
    ctx.fillStyle = "#fff6df"
    ctx.fill()
    ctx.strokeStyle = "#333"
    ctx.stroke()
  }
}

async function persistRouletteProgress(
  entry: CasinoTableEntry,
  result: number,
  delta: number,
  bankroll: number,
  totalStake: number,
  bets: RouletteBet[],
  idempotencyKey: string,
  tableSessionId?: string,
) {
  return recordClientGameRound({
    gameSlug: entry.slug,
    outcome: delta > 0 ? "win" : delta < 0 ? "loss" : "push",
    delta,
    bankroll,
    summary: `Roulette ${result} ${numberColor(result)}; ${formatDelta(delta)}`,
    idempotencyKey,
    tableSessionId,
    totalStake,
    betSnapshot: {
      bets,
      totalStake,
    },
    resultSnapshot: {
      result,
      color: numberColor(result),
    },
  })
}

export function RouletteTablePage({
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
  const tableChipsLabel = isChinese ? "桌台筹码（随结算变化）" : "Table chips (changes each round)"
  const mainWalletNote = isChinese ? "主钱包（买入/离桌时变化）" : "Main wallet (buy-in/cash-out only)"
  const buyInHint = isChinese
    ? "主钱包只在买入和离桌时变化；每次结算会先计入本桌筹码。"
    : "Your wallet changes on buy-in and cash-out. Each round settles into table chips first."
  const defaultChips = [10, 25, 50, 100, 250]
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const settleTimeoutRef = useRef<number | null>(null)
  const wheelAngle = useRef(0)
  const ballAngle = useRef<number | null>(null)
  const ballRadius = useRef(ballPocketRadius)
  const pointerNumberRef = useRef<number | null>(null)
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
  const [bets, setBets] = useState<RouletteBet[]>([])
  const [result, setResult] = useState<number | null>(null)
  const [pointerNumber, setPointerNumber] = useState<number | null>(null)
  const [spinProgress, setSpinProgress] = useState(0)
  const [message, setMessage] = useState(
    isChinese ? "可同局叠加多个下注项目。" : "Multiple bets can be stacked in the same spin.",
  )
  const [spinning, setSpinning] = useState(false)
  const [stats, setStats] = useState<RouletteStats>(() => statsFromProgress(initialProgress))
  const [showRules, setShowRules] = useState(false)
  const [insideTypeA, setInsideTypeA] = useState<"split" | "street">("split")
  const [insideIndexA, setInsideIndexA] = useState(0)
  const [insideTypeB, setInsideTypeB] = useState<"corner" | "sixline">("corner")
  const [insideIndexB, setInsideIndexB] = useState(0)
  const insideOptions = useMemo(() => buildInsideOptions(), [])
  const preview = useMemo(() => calculatePreview(bets), [bets])
  const roi = stats.totalStake > 0 ? (stats.totalDelta / stats.totalStake) * 100 : 0
  const storageKey = `taihu-roulette-table-${entry.slug}`

  function updatePointerNumber(wheelRotation: number) {
    const nextPointerNumber = rouletteResultAtPointer(wheelRotation)

    if (pointerNumberRef.current !== nextPointerNumber) {
      pointerNumberRef.current = nextPointerNumber
      setPointerNumber(nextPointerNumber)
    }
  }

  useEffect(() => {
    drawWheel(canvasRef.current, wheelAngle.current, ballAngle.current, ballRadius.current, result)
  }, [result])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }

      if (settleTimeoutRef.current !== null) {
        window.clearTimeout(settleTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!initialTableSession) {
      window.localStorage.removeItem(storageKey)
      setWalletBalance(initialWalletBalance)
      setTableSession(null)
      setBankroll(0)
      setInitialBankrollInput("0")
      setBets([])
      setResult(null)
      setPointerNumber(null)
      pointerNumberRef.current = null
      setSpinProgress(0)
      setSpinning(false)

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
          stats?: RouletteStats
          result?: number | null
          wheelAngle?: number
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

        if (typeof parsed.result === "number" || parsed.result === null) {
          setResult(parsed.result)
          setPointerNumber(parsed.result)
          pointerNumberRef.current = parsed.result
        }

        if (typeof parsed.wheelAngle === "number") {
          wheelAngle.current = parsed.wheelAngle
          updatePointerNumber(parsed.wheelAngle)
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

  function persistLocal(
    nextBankroll: number,
    nextStats: RouletteStats,
    nextResult: number | null,
    nextWheelAngle: number,
  ) {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        bankroll: nextBankroll,
        stake,
        chips,
        stats: nextStats,
        result: nextResult,
        wheelAngle: nextWheelAngle,
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
      const result = await openClientTableSession(entry.slug, amount, "roulette-buy-in")

      setTableSession(result.tableSession)
      setBankroll(result.tableSession.chipBalance)
      setInitialBankrollInput(String(result.tableSession.chipBalance))
      setWalletBalance(result.walletBalance ?? walletBalance - amount)
      setBets([])
      setResult(null)
      setPointerNumber(null)
      pointerNumberRef.current = null
      setSpinProgress(0)
      window.localStorage.removeItem(storageKey)
      setMessage(isChinese ? "买入成功，桌台筹码已准备好。" : "Buy-in complete. Table chips are ready.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "买入失败。" : "Buy-in failed.")
    } finally {
      setIsOpeningSession(false)
    }
  }

  async function cashOutSession() {
    if (!tableSession || isCashingOut || spinning) {
      return
    }

    setIsCashingOut(true)
    setMessage(isChinese ? "正在带走筹码并结算回钱包..." : "Cashing out table chips to your wallet...")

    try {
      const result = await cashOutClientTableSession(tableSession.id, "roulette-cash-out", tableSession.chipBalance)

      setTableSession(null)
      setBankroll(0)
      setInitialBankrollInput("0")
      setWalletBalance(result.walletBalance ?? walletBalance + tableSession.chipBalance)
      setBets([])
      window.localStorage.removeItem(storageKey)
      setMessage(isChinese ? "筹码已带走，余额已回到钱包。" : "Chips cashed out. Balance returned to wallet.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isChinese ? "离桌失败。" : "Cash-out failed.")
    } finally {
      setIsCashingOut(false)
    }
  }

  function upsertBet(base: Omit<RouletteBet, "amount">) {
    if (spinning) {
      return
    }

    if (!tableSession) {
      setMessage(isChinese ? "请先从钱包买入筹码再入桌。" : "Buy in from your wallet before playing this table.")
      return
    }

    const amount = clampInt(stake, 1)

    if (preview.totalStake + amount > bankroll) {
      setMessage(isChinese ? "余额不足，不能继续追加下注。" : "Insufficient bankroll for another bet.")
      return
    }

    setBets((current) => {
      const existing = current.find((bet) => bet.key === base.key)

      if (existing) {
        return current.map((bet) =>
          bet.key === base.key ? { ...bet, amount: bet.amount + amount } : bet,
        )
      }

      return [...current, { ...base, amount }]
    })
    setMessage(isChinese ? `已下注：${base.labelZh}，${formatMoney(amount)}` : `Bet added: ${base.labelEn}, ${formatMoney(amount)}`)
  }

  function setBetAmount(key: string, amount: number) {
    if (spinning) {
      return
    }

    setBets((current) =>
      current
        .map((bet) => (bet.key === key ? { ...bet, amount: Math.max(0, amount) } : bet))
        .filter((bet) => bet.amount > 0),
    )
  }

  function clearBets() {
    if (spinning) {
      return
    }

    setBets([])
    setMessage(isChinese ? "已清空下注。" : "Bets cleared.")
  }

  function resetTable() {
    if (spinning) {
      return
    }

    const nextBankroll = tableSession?.chipBalance ?? 0

    setBankroll(nextBankroll)
    setInitialBankrollInput(String(nextBankroll))
    setChips(defaultChips)
    setInitialChipsInput(defaultChips.join(","))
    setStake(50)
    setBets([])
    setResult(null)
    setPointerNumber(null)
    pointerNumberRef.current = null
    setSpinProgress(0)
    setStats(initialStats)
    wheelAngle.current = 0
    ballAngle.current = null
    ballRadius.current = ballPocketRadius
    drawWheel(canvasRef.current, 0, null, ballPocketRadius, null)
    window.localStorage.removeItem(storageKey)
    setMessage(isChinese ? "已重置局面。" : "Table reset.")
  }

  function applyInitialSettings() {
    if (spinning) {
      return
    }

    const nextBankroll = tableSession?.chipBalance ?? 0
    const nextChips = parseChips(initialChipsInput, defaultChips)

    setBankroll(nextBankroll)
    setChips(nextChips)
    setStake(nextChips[0])
    setBets([])
    setResult(null)
    setPointerNumber(null)
    pointerNumberRef.current = null
    setSpinProgress(0)
    setStats(initialStats)
    wheelAngle.current = 0
    ballAngle.current = null
    ballRadius.current = ballPocketRadius
    drawWheel(canvasRef.current, 0, null, ballPocketRadius, null)
    window.localStorage.removeItem(storageKey)
    setMessage(isChinese ? "已应用初始设置。" : "Initial settings applied.")
  }

  function addInsideBet(type: "split" | "street" | "corner" | "sixline", numbers: number[]) {
    const config = {
      split: { zh: "分注", en: "Split", payout: 17 },
      street: { zh: "街注", en: "Street", payout: 11 },
      corner: { zh: "角注", en: "Corner", payout: 8 },
      sixline: { zh: "六线", en: "Six Line", payout: 5 },
    }[type]
    const suffix = formatNumbers(numbers)

    upsertBet({
      key: `${type}:${suffix}`,
      labelZh: `${config.zh} ${suffix}`,
      labelEn: `${config.en} ${suffix}`,
      numbers,
      payout: config.payout,
    })
  }

  function spin() {
    if (spinning) {
      return
    }

    if (!tableSession) {
      setMessage(isChinese ? "请先从钱包买入筹码再入桌。" : "Buy in from your wallet before playing this table.")
      return
    }
    const activeTableSession = tableSession

    if (!bets.length) {
      setMessage(isChinese ? "请先添加下注。" : "Place a bet first.")
      return
    }

    if (preview.totalStake > bankroll) {
      setMessage(isChinese ? "余额不足，无法旋转。" : "Insufficient bankroll to spin.")
      return
    }

    const targetIndex = Math.floor(Math.random() * wheelOrder.length)
    const targetResult = wheelOrder[targetIndex]
    const pocketJitter = (Math.random() - 0.5) * wheelPocketAngle * 0.6
    const fromWheel = wheelAngle.current
    const fromBall = ballAngle.current ?? -Math.PI / 2
    const finalWheelAngle = normalizeAngle(wheelAngleForResult(targetResult) + pocketJitter)
    const targetWheel = finalWheelAngle + Math.PI * 2 * (6 + Math.random() * 2.5)
    const ballTravel = Math.PI * 2 * (10 + Math.random() * 3.5)
    const duration = 4600 + Math.random() * 2200
    const settleDelay = 850 + Math.random() * 950
    const start = performance.now()

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
    }

    if (settleTimeoutRef.current !== null) {
      window.clearTimeout(settleTimeoutRef.current)
    }

    setResult(null)
    setPointerNumber(rouletteResultAtPointer(fromWheel))
    pointerNumberRef.current = rouletteResultAtPointer(fromWheel)
    setSpinning(true)
    setSpinProgress(0)
    setMessage(
      isChinese
        ? "轮盘和小球开始旋转，请等待小球减速落袋。"
        : "Wheel and ball are spinning. Wait for the ball to slow into a pocket.",
    )

    const frame = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const wheelEase = 1 - Math.pow(1 - progress, 3)
      const ballEase = 1 - Math.pow(1 - progress, 1.85)
      const liveWheel = fromWheel + (targetWheel - fromWheel) * wheelEase
      let liveBallAngle = fromBall - ballTravel * ballEase
      let liveBallRadius = ballTrackRadius

      if (progress > 0.68) {
        const dropProgress = (progress - 0.68) / 0.32
        liveBallRadius =
          ballTrackRadius - (ballTrackRadius - ballPocketRadius) * (1 - Math.pow(1 - dropProgress, 2))
      }

      if (progress > 0.86) {
        const settleProgress = (progress - 0.86) / 0.14
        const pointerResult = rouletteResultAtPointer(liveWheel)
        const pointerIndex = wheelOrder.indexOf(pointerResult)
        const pocketAngle = pocketCenterAngle(pointerIndex) + liveWheel
        liveBallAngle =
          liveBallAngle + normalizeAngle(pocketAngle - liveBallAngle) * Math.min(1, settleProgress)
      }

      wheelAngle.current = liveWheel
      ballAngle.current = liveBallAngle
      ballRadius.current = liveBallRadius
      drawWheel(canvasRef.current, liveWheel, liveBallAngle, liveBallRadius, null)
      updatePointerNumber(liveWheel)
      setSpinProgress(Math.round(progress * 92))

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(frame)
        return
      }

      setMessage(
        isChinese
          ? "小球正在落袋，荷官确认最终号码..."
          : "The ball is dropping into the pocket. Dealer confirms the final number...",
      )
      wheelAngle.current = finalWheelAngle
      ballAngle.current = null
      ballRadius.current = ballPocketRadius
      const settledResult = rouletteResultAtPointer(finalWheelAngle)
      drawWheel(canvasRef.current, finalWheelAngle, null, ballPocketRadius, settledResult)
      setPointerNumber(settledResult)
      pointerNumberRef.current = settledResult
      setSpinProgress(96)

      settleTimeoutRef.current = window.setTimeout(() => {
        void (async () => {
        const delta = bets.reduce((sum, bet) => sum + payoutOne(bet, settledResult), 0)
        const nextBankroll = bankroll + delta
        const nextStats: RouletteStats = {
          rounds: stats.rounds + 1,
          hitRounds: stats.hitRounds + (delta > 0 ? 1 : 0),
          totalStake: stats.totalStake + preview.totalStake,
          totalDelta: stats.totalDelta + delta,
          lastDelta: delta,
        }

        setResult(settledResult)
        setBankroll(nextBankroll)
        setTableSession({ ...activeTableSession, chipBalance: nextBankroll })
        setStats(nextStats)
        setSpinProgress(100)
        setMessage(
          isChinese
            ? `开出 ${settledResult}（${numberColor(settledResult) === "green" ? "绿" : numberColor(settledResult) === "red" ? "红" : "黑"}），本轮 ${formatDelta(delta)}。`
            : `Landed on ${settledResult} ${numberColor(settledResult)}, round ${formatDelta(delta)}.`,
        )
        persistLocal(nextBankroll, nextStats, settledResult, finalWheelAngle)
        setIsSyncingRound(true)

        try {
          const serverBankroll = await persistRouletteProgress(
            entry,
            settledResult,
            delta,
            nextBankroll,
            preview.totalStake,
            bets,
            `roulette-${entry.slug}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            activeTableSession.id,
          )

          if (typeof serverBankroll === "number") {
            setBankroll(serverBankroll)
            setTableSession((current) => current ? { ...current, chipBalance: serverBankroll } : current)
            persistLocal(serverBankroll, nextStats, settledResult, finalWheelAngle)
          }
        } catch (error) {
          console.error("roulette round sync failed", error)
        } finally {
          setIsSyncingRound(false)
          setSpinning(false)
        }
        })()
      }, settleDelay)
    }

    animationFrameRef.current = window.requestAnimationFrame(frame)
  }

  const optionA = insideOptions[insideTypeA]
  const optionB = insideOptions[insideTypeB]

  return (
    <main className="game-table-shell lobby-shell min-h-screen overflow-hidden bg-background text-foreground">
      <div className="mx-auto grid max-w-[1440px] gap-3 px-4 py-4 lg:px-6">
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
                {isChinese ? "欧式轮盘桌" : "European roulette"}
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
              disabled={spinning}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#214a35] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <BookOpen className="size-4" />
              {isChinese ? "玩法说明" : "Rules"}
            </button>
            <button
              type="button"
              onClick={clearBets}
              disabled={spinning}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#214a35] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Trash2 className="size-4" />
              {isChinese ? "清空下注" : "Clear"}
            </button>
            <button
              type="button"
              onClick={resetTable}
              disabled={spinning}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#214a35] disabled:cursor-not-allowed disabled:opacity-55"
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
                  <label htmlFor="rouletteBuyInAmount" className="text-sm font-black text-[#fff4d8]">
                    {isChinese ? "买入金额" : "Buy-in amount"}
                  </label>
                  <input
                    id="rouletteBuyInAmount"
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

        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-[#d0b06e]/30 bg-white/[0.035] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
                  {isChinese ? "资金与旋转" : "Bankroll & Spin"}
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
                  disabled={spinning || isCashingOut || isSyncingRound}
                  className="inline-flex min-h-12 items-center rounded-lg border border-[#d0b06e]/35 bg-[#173727] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#214a35] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isCashingOut ? (isChinese ? "离桌中..." : "Cashing out...") : isChinese ? "带走筹码" : "Cash out"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={spin}
                disabled={spinning || !tableSession}
                className="inline-flex min-h-12 items-center rounded-lg border border-[#d0b06e]/50 bg-gradient-to-b from-[#f0cf83] to-[#c69d55] px-5 text-base font-black text-[#34240a] shadow-[0_14px_28px_rgba(0,0,0,0.26)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {spinning ? (isChinese ? "旋转中" : "Spinning") : isChinese ? "旋转结算" : "Spin"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-4">
              <div
                className={cn(
                  "grid size-20 place-items-center rounded-full border-2 border-white/25 text-3xl font-black",
                  result === null && "bg-white/10 text-[#fff4d8]",
                  result !== null && numberColor(result) === "green" && "bg-[#1f8a56]",
                  result !== null && numberColor(result) === "red" && "bg-[#b2333f]",
                  result !== null && numberColor(result) === "black" && "bg-[#16181c]",
                )}
              >
                {spinning ? "..." : result ?? "--"}
              </div>
              <div>
                <p className="font-black text-[#fff4d8]">{isChinese ? "结果播报" : "Result"}</p>
                <p className="mt-2 text-sm leading-6 text-[#cbbd91]">{message}</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full border border-white/10 bg-black/25">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r from-transparent via-[#f0cf83] to-transparent transition-all duration-300",
                )}
                style={{ width: `${spinning ? spinProgress : 0}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-[#cbbd91]">
              {isChinese ? "欧式规则：单零（0），暂无 La Partage / En Prison 特殊条款。" : "European wheel: single zero, no La Partage / En Prison rule."}
            </p>
          </div>

          <div className="rounded-lg border border-[#d0b06e]/30 bg-black/25 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
              {isChinese ? "数学计算 & 统计" : "Math & stats"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label={isChinese ? "当前注单数" : "Bet count"} value={String(preview.count)} />
              <Metric label={isChinese ? "总下注额" : "Total stake"} value={formatMoney(preview.totalStake)} />
              <Metric
                label={isChinese ? "理论 EV" : "Theoretical EV"}
                value={formatDelta(preview.expectedValue)}
                tone={preview.expectedValue >= 0 ? "good" : "bad"}
              />
              <Metric label={isChinese ? "至少命中1注概率" : "Hit chance"} value={formatPercent(preview.hitProbability * 100)} />
              <Metric label={isChinese ? "本轮可能最大净赢" : "Max net win"} value={formatMoney(preview.maxWin)} />
              <Metric
                label={isChinese ? "上轮净盈亏" : "Last delta"}
                value={formatDelta(stats.lastDelta)}
                tone={stats.lastDelta >= 0 ? "good" : "bad"}
              />
              <Metric label={isChinese ? "局数 / 命中局" : "Rounds / hits"} value={`${stats.rounds} / ${stats.hitRounds}`} />
              <Metric
                label={isChinese ? "累计 ROI" : "ROI"}
                value={formatPercent(roi)}
                tone={roi >= 0 ? "good" : "bad"}
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#d0b06e]/30 bg-black/20 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
            {isChinese ? "赌桌下注区" : "Betting table"}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label htmlFor="rouletteStakeInput" className="text-sm font-black text-[#fff4d8]">
              {isChinese ? "当前每注金额" : "Current stake"}
            </label>
            <input
              id="rouletteStakeInput"
              type="number"
              min={1}
              step={1}
              value={stake}
              disabled={spinning}
              onChange={(event) => setStake(clampInt(event.target.value, 1))}
              className="h-10 w-32 rounded-lg border border-[#d0b06e]/35 bg-black/25 px-3 text-base font-black text-[#fff4d8] outline-none transition focus:border-[#f0cf83] disabled:cursor-not-allowed disabled:opacity-55"
            />
            <p className="text-sm text-[#cbbd91]">
              {isChinese ? "点击下注位会把当前金额追加到该项目。" : "Click a betting spot to add the current stake."}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((chip, index) => (
              <button
                key={chip}
                type="button"
                onClick={() => setStake(chip)}
                disabled={spinning}
                className={cn(
                  "min-h-12 min-w-20 rounded-full border-2 border-dashed border-white/45 px-4 text-base font-black text-white shadow-[inset_0_2px_10px_rgba(255,255,255,0.25),0_8px_16px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55",
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
            <label htmlFor="rouletteInitialBankroll" className="text-sm font-black text-[#fff4d8]">
              {isChinese ? "初始资金" : "Initial bankroll"}
            </label>
            <input
              id="rouletteInitialBankroll"
              type="number"
              min={100}
              step={100}
              value={initialBankrollInput}
              disabled
              onChange={(event) => setInitialBankrollInput(event.target.value)}
              className="h-10 w-36 rounded-lg border border-[#d0b06e]/35 bg-black/25 px-3 text-base font-black text-[#fff4d8] outline-none transition focus:border-[#f0cf83] disabled:cursor-not-allowed disabled:opacity-55"
            />
            <label htmlFor="rouletteInitialChips" className="text-sm font-black text-[#fff4d8]">
              {isChinese ? "筹码面额" : "Chip values"}
            </label>
            <input
              id="rouletteInitialChips"
              type="text"
              value={initialChipsInput}
              disabled={spinning}
              onChange={(event) => setInitialChipsInput(event.target.value)}
              className="h-10 w-64 rounded-lg border border-[#d0b06e]/35 bg-black/25 px-3 text-base font-black text-[#fff4d8] outline-none transition focus:border-[#f0cf83] disabled:cursor-not-allowed disabled:opacity-55"
            />
            <button
              type="button"
              onClick={applyInitialSettings}
              disabled={spinning}
              className="h-10 rounded-lg border border-[#d0b06e]/35 bg-[#234b33] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#2d5b40] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isChinese ? "应用初始设置" : "Apply settings"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_410px]">
            <div className="overflow-x-auto rounded-lg border-2 border-[#d0b06e]/50 bg-card p-3">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[56px_1fr] gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      upsertBet({
                        key: "straight:0",
                        labelZh: "直注 0",
                        labelEn: "Straight 0",
                        numbers: [0],
                        payout: 35,
                      })
                    }
                    className={cn(
                      "grid min-h-[136px] place-items-center rounded-lg border border-white/20 bg-[#1f8a56] text-2xl font-black text-white",
                      bets.some((bet) => bet.key === "straight:0") && "outline outline-2 outline-[#f0cf83]",
                    )}
                  >
                    0
                    <small className="block text-xs font-semibold">Zero</small>
                  </button>
                  <div className="grid grid-cols-12 grid-rows-3 gap-1">
                    {[0, 1, 2].map((row) =>
                      range(0, 11).map((column) => {
                        const number = column * 3 + row + 1
                        const key = `straight:${number}`

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              upsertBet({
                                key,
                                labelZh: `直注 ${number}`,
                                labelEn: `Straight ${number}`,
                                numbers: [number],
                                payout: 35,
                              })
                            }
                            className={cn(
                              "grid h-11 place-items-center rounded-md border border-white/20 text-sm font-black text-white",
                              redNumbers.has(number) ? "bg-[#ac313d]" : "bg-[#13161a]",
                              bets.some((bet) => bet.key === key) && "outline outline-2 outline-[#f0cf83]",
                            )}
                          >
                            {number}
                          </button>
                        )
                      }),
                    )}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1">
                  <RouletteArea labelZh="第一打" labelEn="1st 12" active={bets.some((bet) => bet.key === "dozen:1")} onClick={() => upsertBet({ key: "dozen:1", labelZh: "第一打", labelEn: "1st 12", numbers: range(1, 12), payout: 2 })} />
                  <RouletteArea labelZh="第二打" labelEn="2nd 12" active={bets.some((bet) => bet.key === "dozen:2")} onClick={() => upsertBet({ key: "dozen:2", labelZh: "第二打", labelEn: "2nd 12", numbers: range(13, 24), payout: 2 })} />
                  <RouletteArea labelZh="第三打" labelEn="3rd 12" active={bets.some((bet) => bet.key === "dozen:3")} onClick={() => upsertBet({ key: "dozen:3", labelZh: "第三打", labelEn: "3rd 12", numbers: range(25, 36), payout: 2 })} />
                </div>

                <div className="mt-2 grid grid-cols-6 gap-1">
                  <RouletteArea labelZh="小" labelEn="1-18" active={bets.some((bet) => bet.key === "low")} onClick={() => upsertBet({ key: "low", labelZh: "小", labelEn: "1-18", numbers: range(1, 18), payout: 1 })} />
                  <RouletteArea labelZh="双" labelEn="EVEN" active={bets.some((bet) => bet.key === "even")} onClick={() => upsertBet({ key: "even", labelZh: "双", labelEn: "Even", numbers: range(1, 36).filter((number) => number % 2 === 0), payout: 1 })} />
                  <RouletteArea labelZh="红" labelEn="RED" active={bets.some((bet) => bet.key === "red")} onClick={() => upsertBet({ key: "red", labelZh: "红", labelEn: "Red", numbers: range(1, 36).filter((number) => redNumbers.has(number)), payout: 1 })} />
                  <RouletteArea labelZh="黑" labelEn="BLACK" active={bets.some((bet) => bet.key === "black")} onClick={() => upsertBet({ key: "black", labelZh: "黑", labelEn: "Black", numbers: range(1, 36).filter((number) => !redNumbers.has(number)), payout: 1 })} />
                  <RouletteArea labelZh="单" labelEn="ODD" active={bets.some((bet) => bet.key === "odd")} onClick={() => upsertBet({ key: "odd", labelZh: "单", labelEn: "Odd", numbers: range(1, 36).filter((number) => number % 2 === 1), payout: 1 })} />
                  <RouletteArea labelZh="大" labelEn="19-36" active={bets.some((bet) => bet.key === "high")} onClick={() => upsertBet({ key: "high", labelZh: "大", labelEn: "19-36", numbers: range(19, 36), payout: 1 })} />
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1">
                  <RouletteArea labelZh="第一列" labelEn="Column 1" active={bets.some((bet) => bet.key === "col:1")} onClick={() => upsertBet({ key: "col:1", labelZh: "第一列", labelEn: "Column 1", numbers: range(1, 34).filter((number) => (number - 1) % 3 === 0), payout: 2 })} />
                  <RouletteArea labelZh="第二列" labelEn="Column 2" active={bets.some((bet) => bet.key === "col:2")} onClick={() => upsertBet({ key: "col:2", labelZh: "第二列", labelEn: "Column 2", numbers: range(2, 35).filter((number) => (number - 2) % 3 === 0), payout: 2 })} />
                  <RouletteArea labelZh="第三列" labelEn="Column 3" active={bets.some((bet) => bet.key === "col:3")} onClick={() => upsertBet({ key: "col:3", labelZh: "第三列", labelEn: "Column 3", numbers: range(3, 36).filter((number) => number % 3 === 0), payout: 2 })} />
                </div>
              </div>
            </div>

            <div className="grid justify-items-center gap-3 rounded-lg border border-[#d0b06e]/30 bg-white/[0.035] p-4">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#d0b06e]">
                {isChinese ? "可视化轮盘" : "Wheel"}
              </p>
              <div className="h-0 w-0 border-x-[12px] border-t-[18px] border-x-transparent border-t-[#efcf8c]" />
              <canvas
                ref={canvasRef}
                width={420}
                height={420}
                className="aspect-square w-full max-w-[320px] rounded-full border-[6px] border-[#d0b06e]/50 bg-[radial-gradient(circle_at_center,#123527_0%,#07150f_70%)]"
              />
              <p className="text-sm text-[#cbbd91]">
                {isChinese ? "当前指针：" : "Pointer:"} {pointerNumber ?? result ?? "--"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <InsideTool
              title={isChinese ? "内注补充：分注 / 街注" : "Inside bets: Split / Street"}
              typeValue={insideTypeA}
              typeOptions={[
                { value: "split", label: isChinese ? "分注 Split (17:1)" : "Split (17:1)" },
                { value: "street", label: isChinese ? "街注 Street (11:1)" : "Street (11:1)" },
              ]}
              numberOptions={optionA}
              selectedIndex={insideIndexA}
              onTypeChange={(value) => {
                setInsideTypeA(value as "split" | "street")
                setInsideIndexA(0)
              }}
              onIndexChange={setInsideIndexA}
              onAdd={() => addInsideBet(insideTypeA, optionA[insideIndexA] ?? optionA[0])}
            />
            <InsideTool
              title={isChinese ? "内注补充：角注 / 六线" : "Inside bets: Corner / Six Line"}
              typeValue={insideTypeB}
              typeOptions={[
                { value: "corner", label: isChinese ? "角注 Corner (8:1)" : "Corner (8:1)" },
                { value: "sixline", label: isChinese ? "六线 Six Line (5:1)" : "Six Line (5:1)" },
              ]}
              numberOptions={optionB}
              selectedIndex={insideIndexB}
              onTypeChange={(value) => {
                setInsideTypeB(value as "corner" | "sixline")
                setInsideIndexB(0)
              }}
              onIndexChange={setInsideIndexB}
              onAdd={() => addInsideBet(insideTypeB, optionB[insideIndexB] ?? optionB[0])}
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-[#d0b06e]/25">
            {bets.length > 0 ? (
              bets.map((bet) => (
                <div
                  key={bet.key}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-white/10 px-4 py-3 text-sm last:border-b-0"
                >
                  <span className="font-black text-[#fff4d8]">
                    {isChinese ? bet.labelZh : bet.labelEn}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={bet.amount}
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
                {isChinese ? "暂无下注，点击赌桌添加。" : "No active bets. Click the table to add one."}
              </div>
            )}
          </div>
        </section>
      </div>

      {showRules ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4">
          <div className="max-h-[86vh] w-full max-w-3xl overflow-auto rounded-lg border border-[#d0b06e]/45 bg-[#0b1c15] p-5 text-[#f8ecd2] shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-black">
                {isChinese ? "欧式轮盘下注说明" : "European roulette rules"}
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
                    <th className="border border-white/10 p-3">{isChinese ? "类型" : "Type"}</th>
                    <th className="border border-white/10 p-3">{isChinese ? "覆盖号码" : "Coverage"}</th>
                    <th className="border border-white/10 p-3">{isChinese ? "赔率" : "Payout"}</th>
                  </tr>
                </thead>
                <tbody>
                  <RuleRow label={isChinese ? "直注" : "Straight"} coverage="1" odds="35:1" />
                  <RuleRow label={isChinese ? "分注" : "Split"} coverage="2" odds="17:1" />
                  <RuleRow label={isChinese ? "街注" : "Street"} coverage="3" odds="11:1" />
                  <RuleRow label={isChinese ? "角注" : "Corner"} coverage="4" odds="8:1" />
                  <RuleRow label={isChinese ? "六线" : "Six Line"} coverage="6" odds="5:1" />
                  <RuleRow label={isChinese ? "红/黑、单/双、大/小" : "Even-money outside"} coverage="18" odds="1:1" />
                  <RuleRow label={isChinese ? "打、列" : "Dozen / Column"} coverage="12" odds="2:1" />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function RouletteArea({
  labelZh,
  labelEn,
  active,
  onClick,
}: {
  labelZh: string
  labelEn: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-md border border-white/20 bg-black/25 px-2 py-2 text-center text-sm font-black text-[#fff4d8] transition hover:border-[#f0cf83]",
        active && "outline outline-2 outline-[#f0cf83]",
      )}
    >
      {labelZh}
      <small className="block text-[11px] font-semibold text-[#d8d8d8]">{labelEn}</small>
    </button>
  )
}

function InsideTool({
  title,
  typeValue,
  typeOptions,
  numberOptions,
  selectedIndex,
  onTypeChange,
  onIndexChange,
  onAdd,
}: {
  title: string
  typeValue: string
  typeOptions: Array<{ value: string; label: string }>
  numberOptions: number[][]
  selectedIndex: number
  onTypeChange: (value: string) => void
  onIndexChange: (value: number) => void
  onAdd: () => void
}) {
  return (
    <div className="rounded-lg border border-[#d0b06e]/25 bg-black/20 p-3">
      <p className="mb-3 text-sm font-black text-[#fff4d8]">{title}</p>
      <div className="flex flex-wrap gap-2">
        <select
          value={typeValue}
          onChange={(event) => onTypeChange(event.target.value)}
          className="h-10 rounded-lg border border-[#d0b06e]/35 bg-[#07150f] px-3 text-sm font-black text-[#fff4d8]"
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={selectedIndex}
          onChange={(event) => onIndexChange(Number(event.target.value))}
          className="h-10 min-w-44 rounded-lg border border-[#d0b06e]/35 bg-[#07150f] px-3 text-sm font-black text-[#fff4d8]"
        >
          {numberOptions.map((numbers, index) => (
            <option key={`${index}-${numbers.join("-")}`} value={index}>
              {formatNumbers(numbers)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onAdd}
          className="h-10 rounded-lg border border-[#d0b06e]/35 bg-[#234b33] px-4 text-sm font-black text-[#fff4d8] transition hover:bg-[#2d5b40]"
        >
          添加
        </button>
      </div>
    </div>
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

function RuleRow({ label, coverage, odds }: { label: string; coverage: string; odds: string }) {
  return (
    <tr>
      <td className="border border-white/10 p-3 font-black">{label}</td>
      <td className="border border-white/10 p-3 text-[#d9ceb0]">{coverage}</td>
      <td className="border border-white/10 p-3 text-[#f4d18a]">{odds}</td>
    </tr>
  )
}
