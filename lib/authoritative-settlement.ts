import { randomInt } from "node:crypto"

import type { GameRuleSet } from "@/lib/game-catalog"
// Node's native TypeScript test runner requires the explicit extension here.
import {
  evaluateSicBoRoll,
  isRegionalGameRuleId,
  SIC_BO_NET_ODDS,
  settleRegionalGameRound,
} from "./game-rules/index.ts"
import type { ProgressOutcome } from "@/lib/member-data"

type RandomInt = (max: number) => number

export interface AuthoritativeSettlement {
  outcome: ProgressOutcome
  delta: number
  totalStake: number
  summary: string
  betSnapshot: Record<string, unknown>
  resultSnapshot: Record<string, unknown>
}

const baccaratKeys = ["player", "banker", "tie", "playerPair", "bankerPair"] as const
const diceKeys = ["big", "small", "odd", "even", "triple"] as const
const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

function money(value: number) {
  return Math.round(value * 100) / 100
}

function amount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1000000) {
    return 0
  }

  return money(value)
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function outcomeFor(delta: number): ProgressOutcome {
  return delta > 0 ? "win" : delta < 0 ? "loss" : "push"
}

function requireStake(totalStake: number) {
  if (totalStake <= 0) {
    throw new Error("At least one valid bet is required.")
  }

  return money(totalStake)
}

function canonicalLedger<const Key extends string>(value: unknown, keys: readonly Key[]) {
  const source = record(value)
  return Object.fromEntries(keys.map((key) => [key, amount(source[key])])) as Record<Key, number>
}

function baccaratCardPoint(rank: number) {
  return rank >= 10 ? 0 : rank
}

function baccaratHandPoint(cards: Array<{ rank: number }>) {
  return cards.reduce((sum, card) => sum + baccaratCardPoint(card.rank), 0) % 10
}

function shouldBankerDraw(bankerPoint: number, playerThirdPoint: number | null) {
  if (playerThirdPoint === null) return bankerPoint <= 5
  if (bankerPoint <= 2) return true
  if (bankerPoint === 3) return playerThirdPoint !== 8
  if (bankerPoint === 4) return playerThirdPoint >= 2 && playerThirdPoint <= 7
  if (bankerPoint === 5) return playerThirdPoint >= 4 && playerThirdPoint <= 7
  if (bankerPoint === 6) return playerThirdPoint === 6 || playerThirdPoint === 7
  return false
}

function drawBaccaratCard(rng: RandomInt) {
  return { rank: rng(13) + 1, suit: ["spades", "hearts", "diamonds", "clubs"][rng(4)] }
}

function settleBaccarat(betSnapshot: Record<string, unknown>, rng: RandomInt): AuthoritativeSettlement {
  const bets = canonicalLedger(record(betSnapshot).bets, baccaratKeys)
  const totalStake = requireStake(Object.values(bets).reduce((sum, bet) => sum + bet, 0))
  const playerCards = [drawBaccaratCard(rng), drawBaccaratCard(rng)]
  const bankerCards = [drawBaccaratCard(rng), drawBaccaratCard(rng)]
  let playerPoint = baccaratHandPoint(playerCards)
  let bankerPoint = baccaratHandPoint(bankerCards)

  if (playerPoint < 8 && bankerPoint < 8) {
    let playerThirdPoint: number | null = null
    if (playerPoint <= 5) {
      const thirdCard = drawBaccaratCard(rng)
      playerCards.push(thirdCard)
      playerThirdPoint = baccaratCardPoint(thirdCard.rank)
      playerPoint = baccaratHandPoint(playerCards)
    }
    if (shouldBankerDraw(bankerPoint, playerThirdPoint)) {
      bankerCards.push(drawBaccaratCard(rng))
      bankerPoint = baccaratHandPoint(bankerCards)
    }
  }

  const winner = playerPoint === bankerPoint ? "T" : playerPoint > bankerPoint ? "P" : "B"
  const playerPair = playerCards[0].rank === playerCards[1].rank
  const bankerPair = bankerCards[0].rank === bankerCards[1].rank
  let delta = 0

  if (winner === "P") {
    delta += bets.player - bets.banker - bets.tie
  } else if (winner === "B") {
    delta += bets.banker * 0.95 - bets.player - bets.tie
  } else {
    delta += bets.tie * 8
  }

  delta += playerPair ? bets.playerPair * 11 : -bets.playerPair
  delta += bankerPair ? bets.bankerPair * 11 : -bets.bankerPair
  delta = money(delta)

  return {
    outcome: outcomeFor(delta),
    delta,
    totalStake,
    summary: `Baccarat ${winner} ${playerPoint}:${bankerPoint}; ${delta >= 0 ? "+" : ""}${delta}`,
    betSnapshot: { bets, totalStake },
    resultSnapshot: { winner, playerPoint, bankerPoint, playerPair, bankerPair, playerCards, bankerCards, rng: "node:crypto.randomInt" },
  }
}

function settleDice(betSnapshot: Record<string, unknown>, rng: RandomInt): AuthoritativeSettlement {
  const bets = canonicalLedger(record(betSnapshot).bets, diceKeys)
  const totalStake = requireStake(Object.values(bets).reduce((sum, bet) => sum + bet, 0))
  const dice = [rng(6) + 1, rng(6) + 1, rng(6) + 1] as [number, number, number]
  const { sum, triple, wins } = evaluateSicBoRoll(dice)
  const delta = money(diceKeys.reduce((sumDelta, key) => (
    sumDelta + (wins[key] ? bets[key] * SIC_BO_NET_ODDS[key] : -bets[key])
  ), 0))

  return {
    outcome: outcomeFor(delta),
    delta,
    totalStake,
    summary: `Dice ${dice.join("+")}=${sum}; ${delta >= 0 ? "+" : ""}${delta}`,
    betSnapshot: { bets, totalStake },
    resultSnapshot: { dice, sum, triple, rng: "node:crypto.randomInt" },
  }
}

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

function rouletteOptions() {
  const options = new Map<string, { numbers: number[], payout: number }>()
  for (let number = 0; number <= 36; number += 1) options.set(`straight:${number}`, { numbers: [number], payout: 35 })
  for (let row = 0; row < 12; row += 1) {
    const street = [row * 3 + 1, row * 3 + 2, row * 3 + 3]
    options.set(`street:${street.join("/")}`, { numbers: street, payout: 11 })
    for (let column = 0; column < 3; column += 1) {
      const number = row * 3 + column + 1
      if (column < 2) options.set(`split:${number}/${number + 1}`, { numbers: [number, number + 1], payout: 17 })
      if (row < 11) options.set(`split:${number}/${number + 3}`, { numbers: [number, number + 3], payout: 17 })
    }
  }
  for (let row = 0; row < 11; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const number = row * 3 + column + 1
      const numbers = [number, number + 1, number + 3, number + 4]
      options.set(`corner:${numbers.join("/")}`, { numbers, payout: 8 })
    }
    const sixline = range(row * 3 + 1, row * 3 + 6)
    options.set(`sixline:${sixline.join("/")}`, { numbers: sixline, payout: 5 })
  }
  for (let dozen = 1; dozen <= 3; dozen += 1) options.set(`dozen:${dozen}`, { numbers: range((dozen - 1) * 12 + 1, dozen * 12), payout: 2 })
  for (let column = 1; column <= 3; column += 1) options.set(`col:${column}`, { numbers: range(column, 36).filter((number) => (number - column) % 3 === 0), payout: 2 })
  options.set("low", { numbers: range(1, 18), payout: 1 })
  options.set("high", { numbers: range(19, 36), payout: 1 })
  options.set("even", { numbers: range(1, 36).filter((number) => number % 2 === 0), payout: 1 })
  options.set("odd", { numbers: range(1, 36).filter((number) => number % 2 === 1), payout: 1 })
  options.set("red", { numbers: range(1, 36).filter((number) => redNumbers.has(number)), payout: 1 })
  options.set("black", { numbers: range(1, 36).filter((number) => !redNumbers.has(number)), payout: 1 })
  return options
}

const canonicalRouletteOptions = rouletteOptions()

function settleRoulette(betSnapshot: Record<string, unknown>, rng: RandomInt): AuthoritativeSettlement {
  const sourceBets = Array.isArray(record(betSnapshot).bets) ? record(betSnapshot).bets as unknown[] : []
  const bets = sourceBets.flatMap((value) => {
    const source = record(value)
    const key = typeof source.key === "string" ? source.key : ""
    const option = canonicalRouletteOptions.get(key)
    const betAmount = amount(source.amount)
    return option && betAmount > 0 ? [{ key, amount: betAmount, ...option }] : []
  }).slice(0, 100)
  const totalStake = requireStake(bets.reduce((sum, bet) => sum + bet.amount, 0))
  const result = rng(37)
  const color = result === 0 ? "green" : redNumbers.has(result) ? "red" : "black"
  const delta = money(bets.reduce((sum, bet) => (
    sum + (bet.numbers.includes(result) ? bet.amount * bet.payout : -bet.amount)
  ), 0))

  return {
    outcome: outcomeFor(delta),
    delta,
    totalStake,
    summary: `Roulette ${result} ${color}; ${delta >= 0 ? "+" : ""}${delta}`,
    betSnapshot: { bets: bets.map(({ key, amount: betAmount }) => ({ key, amount: betAmount })), totalStake },
    resultSnapshot: { result, color, rng: "node:crypto.randomInt" },
  }
}

export function settleAuthoritativeRound(
  ruleSet: GameRuleSet | undefined,
  betSnapshot: Record<string, unknown>,
  rng: RandomInt = randomInt,
) {
  if (ruleSet === "baccarat") return settleBaccarat(betSnapshot, rng)
  if (ruleSet === "blackjack") {
    throw new Error("Blackjack uses the versioned server-side round state machine.")
  }
  if (ruleSet === "roulette") return settleRoulette(betSnapshot, rng)
  if (ruleSet === "dice") return settleDice(betSnapshot, rng)
  if (isRegionalGameRuleId(ruleSet)) {
    return settleRegionalGameRound(ruleSet, betSnapshot, rng)
  }
  throw new Error("This table does not support authoritative wagering settlement.")
}
