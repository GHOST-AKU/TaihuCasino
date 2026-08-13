import {
  canonicalizeBets,
  randomIndex,
  settleFixedOdds,
  settlementOutcome,
} from "#game-rules/core"
import type { GameRuleMetadata, RandomInt, RegionalSettlement } from "#game-rules/types"

export type SicBoBetKey = "big" | "small" | "odd" | "even" | "triple"
export type SicBoDice = readonly [number, number, number]

export interface SicBoEvaluation {
  sum: number
  triple: boolean
  wins: Record<SicBoBetKey, boolean>
}

const sicBoKeys = ["big", "small", "odd", "even", "triple"] as const
export const SIC_BO_NET_ODDS: Readonly<Record<SicBoBetKey, number>> = {
  big: 1,
  small: 1,
  odd: 1,
  even: 1,
  triple: 24,
}

const sicBoLabels: Record<SicBoBetKey, { en: string, zh: string }> = {
  big: { en: "Big 11–17", zh: "大 11–17" },
  small: { en: "Small 4–10", zh: "小 4–10" },
  odd: { en: "Odd", zh: "单" },
  even: { en: "Even", zh: "双" },
  triple: { en: "Any Triple", zh: "任意豹子" },
}

export const SIC_BO_RULES: GameRuleMetadata<"dice", SicBoBetKey> = {
  id: "dice",
  rulesVersion: "sic-bo/1.0.0",
  labels: { en: "Sic Bo", zh: "骰宝" },
  shortDescription: {
    en: "Three-dice Sic Bo; any triple defeats big, small, odd, and even bets.",
    zh: "三骰骰宝；出现任意豹子时，大小与单双投注全部判负。",
  },
  betOptions: sicBoKeys.map((key) => {
    const isTriple = key === "triple"
    return {
      key,
      labels: sicBoLabels[key],
      netOdds: { min: SIC_BO_NET_ODDS[key], max: SIC_BO_NET_ODDS[key] },
      probability: isTriple ? 1 / 36 : 105 / 216,
      expectedValue: isTriple ? -11 / 36 : -1 / 36,
    }
  }),
}

export function evaluateSicBoRoll(dice: SicBoDice): SicBoEvaluation {
  if (dice.some((die) => !Number.isInteger(die) || die < 1 || die > 6)) {
    throw new Error("Sic Bo dice must be integers from one through six.")
  }

  const sum = dice[0] + dice[1] + dice[2]
  const triple = dice[0] === dice[1] && dice[1] === dice[2]

  return {
    sum,
    triple,
    wins: {
      big: !triple && sum >= 11 && sum <= 17,
      small: !triple && sum >= 4 && sum <= 10,
      odd: !triple && sum % 2 === 1,
      even: !triple && sum % 2 === 0,
      triple,
    },
  }
}

export function evaluateSicBoBets(dice: SicBoDice) {
  return evaluateSicBoRoll(dice).wins
}

export function settleSicBoRound(
  betSnapshot: Record<string, unknown>,
  rng: RandomInt,
): RegionalSettlement<SicBoBetKey> {
  const canonical = canonicalizeBets(
    SIC_BO_RULES.id,
    SIC_BO_RULES.rulesVersion,
    betSnapshot,
    sicBoKeys,
  )
  const dice = [
    randomIndex(rng, 6) + 1,
    randomIndex(rng, 6) + 1,
    randomIndex(rng, 6) + 1,
  ] as const
  const evaluation = evaluateSicBoRoll(dice)
  const delta = settleFixedOdds(canonical.bets, evaluation.wins, SIC_BO_NET_ODDS)

  return {
    outcome: settlementOutcome(delta),
    delta,
    totalStake: canonical.totalStake,
    summary: `Sic Bo ${dice.join("+")}=${evaluation.sum}${evaluation.triple ? " triple" : ""}; ${delta >= 0 ? "+" : ""}${delta}`,
    rulesVersion: SIC_BO_RULES.rulesVersion,
    betSnapshot: canonical,
    resultSnapshot: {
      ruleSet: SIC_BO_RULES.id,
      rulesVersion: SIC_BO_RULES.rulesVersion,
      dice,
      sum: evaluation.sum,
      triple: evaluation.triple,
      winningKeys: sicBoKeys.filter((key) => evaluation.wins[key]),
      rng: "server:randomInt",
    },
  }
}
