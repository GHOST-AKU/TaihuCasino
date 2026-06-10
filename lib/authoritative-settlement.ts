import { randomInt } from "node:crypto"

import type { GameRuleSet } from "@/lib/game-catalog"
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

function settleBaccarat(betSnapshot: Record<string, unknown>, rng: RandomInt): AuthoritativeSettlement {
  const bets = canonicalLedger(record(betSnapshot).bets, baccaratKeys)
  const totalStake = requireStake(Object.values(bets).reduce((sum, bet) => sum + bet, 0))
  const playerPoint = rng(10)
  const bankerPoint = rng(10)
  const winner = playerPoint === bankerPoint ? "T" : playerPoint > bankerPoint ? "P" : "B"
  const playerPair = rng(13) === 0
  const bankerPair = rng(13) === 0
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
    resultSnapshot: { winner, playerPoint, bankerPoint, playerPair, bankerPair, rng: "node:crypto.randomInt" },
  }
}

function settleDice(betSnapshot: Record<string, unknown>, rng: RandomInt): AuthoritativeSettlement {
  const bets = canonicalLedger(record(betSnapshot).bets, diceKeys)
  const totalStake = requireStake(Object.values(bets).reduce((sum, bet) => sum + bet, 0))
  const dice = [rng(6) + 1, rng(6) + 1, rng(6) + 1] as [number, number, number]
  const sum = dice[0] + dice[1] + dice[2]
  const triple = dice[0] === dice[1] && dice[1] === dice[2]
  const wins = {
    big: sum >= 11 && sum <= 17,
    small: sum >= 4 && sum <= 10,
    odd: sum % 2 === 1,
    even: sum % 2 === 0,
    triple,
  }
  const payouts = { big: 1, small: 1, odd: 1, even: 1, triple: 24 }
  const delta = money(diceKeys.reduce((sumDelta, key) => (
    sumDelta + (wins[key] ? bets[key] * payouts[key] : -bets[key])
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

function drawCard(rng: RandomInt) {
  return rng(13) + 1
}

function cardTotal(cards: number[]) {
  let total = cards.reduce((sum, rank) => sum + (rank === 1 ? 11 : Math.min(rank, 10)), 0)
  let aces = cards.filter((rank) => rank === 1).length
  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }
  return total
}

function settleBlackjack(betSnapshot: Record<string, unknown>, rng: RandomInt): AuthoritativeSettlement {
  const source = record(betSnapshot)
  const hands = (Array.isArray(source.hands) ? source.hands : []).flatMap((value) => {
    const hand = record(value)
    const bet = amount(hand.bet)
    return bet > 0 ? [{ bet }] : []
  }).slice(0, 4)
  const insuranceBet = amount(source.insuranceBet)
  const totalStake = requireStake(hands.reduce((sum, hand) => sum + hand.bet, insuranceBet))
  const dealerCards = [drawCard(rng), drawCard(rng)]
  while (cardTotal(dealerCards) < 17) dealerCards.push(drawCard(rng))
  const dealerTotal = cardTotal(dealerCards)
  const dealerBlackjack = dealerCards.length === 2 && dealerTotal === 21
  let delta = dealerBlackjack && insuranceBet > 0 ? insuranceBet * 2 : -insuranceBet
  const settledHands = hands.map(({ bet }) => {
    const cards = [drawCard(rng), drawCard(rng)]
    while (cardTotal(cards) < 17) cards.push(drawCard(rng))
    const playerTotal = cardTotal(cards)
    const naturalBlackjack = cards.length === 2 && playerTotal === 21
    const handDelta = playerTotal > 21 || (dealerBlackjack && !naturalBlackjack)
      ? -bet
      : naturalBlackjack && !dealerBlackjack
        ? bet * 1.5
        : dealerTotal > 21 || playerTotal > dealerTotal
          ? bet
          : playerTotal < dealerTotal ? -bet : 0
    delta += handDelta
    return { bet, cards, playerTotal, naturalBlackjack, delta: money(handDelta) }
  })
  delta = money(delta)

  return {
    outcome: outcomeFor(delta),
    delta,
    totalStake,
    summary: `Blackjack dealer ${dealerTotal}; ${delta >= 0 ? "+" : ""}${delta}`,
    betSnapshot: { hands: hands.map(({ bet }) => ({ bet })), insuranceBet, totalStake },
    resultSnapshot: { dealerCards, dealerTotal, hands: settledHands, rng: "node:crypto.randomInt" },
  }
}

export function settleAuthoritativeRound(
  ruleSet: GameRuleSet | undefined,
  betSnapshot: Record<string, unknown>,
  rng: RandomInt = randomInt,
) {
  if (ruleSet === "baccarat") return settleBaccarat(betSnapshot, rng)
  if (ruleSet === "blackjack") return settleBlackjack(betSnapshot, rng)
  if (ruleSet === "roulette") return settleRoulette(betSnapshot, rng)
  if (ruleSet === "dice") return settleDice(betSnapshot, rng)
  throw new Error("This table does not support authoritative wagering settlement.")
}
