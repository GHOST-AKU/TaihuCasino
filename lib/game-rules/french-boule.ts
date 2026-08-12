import {
  canonicalizeBets,
  randomIndex,
  settleFixedOdds,
  settlementOutcome,
} from "#game-rules/core"
import type { GameRuleMetadata, RandomInt, RegionalSettlement } from "#game-rules/types"

export type FrenchBouleNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export type FrenchBouleBetKey =
  | "red"
  | "black"
  | "odd"
  | "even"
  | "low"
  | "high"
  | `number:${FrenchBouleNumber}`

const simpleBouleKeys = ["red", "black", "odd", "even", "low", "high"] as const
const bouleNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const numberBouleKeys = bouleNumbers.map((number) => `number:${number}` as const)
const frenchBouleKeys = [...simpleBouleKeys, ...numberBouleKeys] as const
const redNumbers = new Set<number>([1, 3, 6, 8])
const blackNumbers = new Set<number>([2, 4, 7, 9])
const oddNumbers = new Set<number>([1, 3, 7, 9])
const evenNumbers = new Set<number>([2, 4, 6, 8])

const frenchBouleNetOdds = Object.fromEntries(frenchBouleKeys.map((key) => [
  key,
  key.startsWith("number:") ? 7 : 1,
])) as Record<FrenchBouleBetKey, number>

const simpleLabels: Record<(typeof simpleBouleKeys)[number], { en: string, zh: string }> = {
  red: { en: "Red", zh: "红" },
  black: { en: "Black", zh: "黑" },
  odd: { en: "Odd (Impair)", zh: "单（Impair）" },
  even: { en: "Even (Pair)", zh: "双（Pair）" },
  low: { en: "Low 1–4 (Manque)", zh: "小 1–4（Manque）" },
  high: { en: "High 6–9 (Passe)", zh: "大 6–9（Passe）" },
}

export const FRENCH_BOULE_RULES: GameRuleMetadata<"french-boule", FrenchBouleBetKey> = {
  id: "french-boule",
  rulesVersion: "1.0.0",
  labels: { en: "French Boule", zh: "法式滚球" },
  shortDescription: {
    en: "A compact one-to-nine French wheel where yellow five is the house number.",
    zh: "一至九号的法式小轮盘，黄色五号为庄家号。",
  },
  betOptions: [
    ...simpleBouleKeys.map((key) => ({
      key,
      labels: simpleLabels[key],
      netOdds: { min: 1, max: 1 },
      probability: 4 / 9,
      expectedValue: -1 / 9,
    })),
    ...bouleNumbers.map((number) => ({
      key: `number:${number}` as const,
      labels: { en: `Number ${number}`, zh: `${number} 号` },
      netOdds: { min: 7, max: 7 },
      probability: 1 / 9,
      expectedValue: -1 / 9,
    })),
  ],
}

export function settleFrenchBouleRound(
  betSnapshot: Record<string, unknown>,
  rng: RandomInt,
): RegionalSettlement<FrenchBouleBetKey> {
  const canonical = canonicalizeBets(
    FRENCH_BOULE_RULES.id,
    FRENCH_BOULE_RULES.rulesVersion,
    betSnapshot,
    frenchBouleKeys,
  )
  const result = randomIndex(rng, 9) + 1 as FrenchBouleNumber
  const color = result === 5 ? "yellow" : redNumbers.has(result) ? "red" : "black"
  const wins = Object.fromEntries(frenchBouleKeys.map((key) => {
    if (key.startsWith("number:")) return [key, key === `number:${result}`]
    if (key === "red") return [key, redNumbers.has(result)]
    if (key === "black") return [key, blackNumbers.has(result)]
    if (key === "odd") return [key, oddNumbers.has(result)]
    if (key === "even") return [key, evenNumbers.has(result)]
    if (key === "low") return [key, result >= 1 && result <= 4]
    return [key, result >= 6 && result <= 9]
  })) as Record<FrenchBouleBetKey, boolean>
  const delta = settleFixedOdds(canonical.bets, wins, frenchBouleNetOdds)
  const winningKeys = frenchBouleKeys.filter((key) => wins[key])

  return {
    outcome: settlementOutcome(delta),
    delta,
    totalStake: canonical.totalStake,
    summary: `French Boule ${result} ${color}; ${delta >= 0 ? "+" : ""}${delta}`,
    rulesVersion: FRENCH_BOULE_RULES.rulesVersion,
    betSnapshot: canonical,
    resultSnapshot: {
      ruleSet: FRENCH_BOULE_RULES.id,
      rulesVersion: FRENCH_BOULE_RULES.rulesVersion,
      result,
      color,
      winningKeys,
      rng: "server:randomInt",
    },
  }
}
