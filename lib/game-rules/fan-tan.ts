import {
  canonicalizeBets,
  randomIndex,
  settleFixedOdds,
  settlementOutcome,
} from "#game-rules/core"
import type { GameRuleMetadata, RandomInt, RegionalSettlement } from "#game-rules/types"

export type FanTanBetKey = "remainder:1" | "remainder:2" | "remainder:3" | "remainder:4"

const fanTanKeys = ["remainder:1", "remainder:2", "remainder:3", "remainder:4"] as const
const fanTanNetOdds = Object.fromEntries(fanTanKeys.map((key) => [key, 2.85])) as Record<FanTanBetKey, number>

export const FAN_TAN_RULES: GameRuleMetadata<"fan-tan", FanTanBetKey> = {
  id: "fan-tan",
  rulesVersion: "1.0.0",
  labels: { en: "Fan-Tan", zh: "番摊" },
  shortDescription: {
    en: "Predict the one-to-four remainder after a pile is counted away in groups of four.",
    zh: "将筹码每四枚分组移走，预测最终余下的一至四枚。",
  },
  betOptions: fanTanKeys.map((key, index) => ({
    key,
    labels: { en: `Remainder ${index + 1}`, zh: `余 ${index + 1}` },
    netOdds: { min: 2.85, max: 2.85 },
    probability: 1 / 4,
    expectedValue: -0.0375,
  })),
}

export function settleFanTanRound(
  betSnapshot: Record<string, unknown>,
  rng: RandomInt,
): RegionalSettlement<FanTanBetKey> {
  const canonical = canonicalizeBets(
    FAN_TAN_RULES.id,
    FAN_TAN_RULES.rulesVersion,
    betSnapshot,
    fanTanKeys,
  )
  const remainder = randomIndex(rng, 4) + 1
  const groupsOfFour = randomIndex(rng, 24) + 8
  const beadCount = groupsOfFour * 4 + remainder
  const winningKey = `remainder:${remainder}` as FanTanBetKey
  const wins = Object.fromEntries(fanTanKeys.map((key) => [key, key === winningKey])) as Record<FanTanBetKey, boolean>
  const delta = settleFixedOdds(canonical.bets, wins, fanTanNetOdds)

  return {
    outcome: settlementOutcome(delta),
    delta,
    totalStake: canonical.totalStake,
    summary: `Fan-Tan remainder ${remainder} from ${beadCount}; ${delta >= 0 ? "+" : ""}${delta}`,
    rulesVersion: FAN_TAN_RULES.rulesVersion,
    betSnapshot: canonical,
    resultSnapshot: {
      ruleSet: FAN_TAN_RULES.id,
      rulesVersion: FAN_TAN_RULES.rulesVersion,
      beadCount,
      remainder,
      winningKey,
      rng: "server:randomInt",
    },
  }
}
