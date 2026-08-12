import { FAN_TAN_RULES, settleFanTanRound } from "#game-rules/fan-tan"
import { FRENCH_BOULE_RULES, settleFrenchBouleRound } from "#game-rules/french-boule"
import {
  CROWN_ANCHOR_RULES,
  FISH_PRAWN_CRAB_RULES,
  settleSymbolDiceRound,
} from "#game-rules/symbol-dice"
import type { RandomInt } from "#game-rules/types"

export * from "#game-rules/core"
export * from "#game-rules/fan-tan"
export * from "#game-rules/french-boule"
export * from "#game-rules/sic-bo"
export * from "#game-rules/symbol-dice"
export * from "#game-rules/types"

export const REGIONAL_GAME_RULES = {
  "fish-prawn-crab": FISH_PRAWN_CRAB_RULES,
  "crown-anchor": CROWN_ANCHOR_RULES,
  "fan-tan": FAN_TAN_RULES,
  "french-boule": FRENCH_BOULE_RULES,
} as const

export type RegionalGameRuleId = keyof typeof REGIONAL_GAME_RULES

export const REGIONAL_GAME_RULE_IDS = Object.freeze(
  Object.keys(REGIONAL_GAME_RULES) as RegionalGameRuleId[],
)

export function isRegionalGameRuleId(ruleSet: unknown): ruleSet is RegionalGameRuleId {
  return typeof ruleSet === "string" && Object.hasOwn(REGIONAL_GAME_RULES, ruleSet)
}

export function getRegionalGameRules(ruleSet: string) {
  return isRegionalGameRuleId(ruleSet)
    ? REGIONAL_GAME_RULES[ruleSet]
    : undefined
}

export function settleRegionalGameRound(
  ruleSet: RegionalGameRuleId,
  betSnapshot: Record<string, unknown>,
  rng: RandomInt,
) {
  switch (ruleSet) {
    case "fish-prawn-crab":
      return settleSymbolDiceRound(FISH_PRAWN_CRAB_RULES, betSnapshot, rng)
    case "crown-anchor":
      return settleSymbolDiceRound(CROWN_ANCHOR_RULES, betSnapshot, rng)
    case "fan-tan":
      return settleFanTanRound(betSnapshot, rng)
    case "french-boule":
      return settleFrenchBouleRound(betSnapshot, rng)
    default: {
      const exhaustive: never = ruleSet
      throw new Error(`No regional settlement is registered for ${String(exhaustive)}.`)
    }
  }
}
