import { canonicalizeBets, money, randomIndex, settlementOutcome } from "#game-rules/core"
import type {
  BetOptionMetadata,
  GameRuleMetadata,
  LocalizedText,
  RandomInt,
  RegionalSettlement,
} from "#game-rules/types"

export type FishPrawnCrabBetKey = "fish" | "prawn" | "crab" | "coin" | "gourd" | "rooster"
export type CrownAnchorBetKey = "crown" | "anchor" | "heart" | "diamond" | "club" | "spade"
export type SymbolDiceRuleId = "fish-prawn-crab" | "crown-anchor"

export interface SymbolDiceFace<Key extends string> {
  key: Key
  labels: LocalizedText
}

export interface SymbolDiceRules<Id extends SymbolDiceRuleId, Key extends string>
  extends GameRuleMetadata<Id, Key> {
  symbols: readonly SymbolDiceFace<Key>[]
}

const SYMBOL_WIN_PROBABILITY = 91 / 216
const SYMBOL_EXPECTED_VALUE = -17 / 216

function symbolBetOption<const Key extends string>(
  key: Key,
  labels: LocalizedText,
): BetOptionMetadata<Key> {
  return {
    key,
    labels,
    netOdds: { min: 1, max: 3 },
    probability: SYMBOL_WIN_PROBABILITY,
    expectedValue: SYMBOL_EXPECTED_VALUE,
  }
}

const fishPrawnCrabSymbols = [
  { key: "fish", labels: { en: "Fish", zh: "鱼" } },
  { key: "prawn", labels: { en: "Prawn", zh: "虾" } },
  { key: "crab", labels: { en: "Crab", zh: "蟹" } },
  { key: "coin", labels: { en: "Coin", zh: "铜钱" } },
  { key: "gourd", labels: { en: "Gourd", zh: "葫芦" } },
  { key: "rooster", labels: { en: "Rooster", zh: "鸡" } },
] as const satisfies readonly SymbolDiceFace<FishPrawnCrabBetKey>[]

const crownAnchorSymbols = [
  { key: "crown", labels: { en: "Crown", zh: "皇冠" } },
  { key: "anchor", labels: { en: "Anchor", zh: "船锚" } },
  { key: "heart", labels: { en: "Heart", zh: "红心" } },
  { key: "diamond", labels: { en: "Diamond", zh: "方块" } },
  { key: "club", labels: { en: "Club", zh: "梅花" } },
  { key: "spade", labels: { en: "Spade", zh: "黑桃" } },
] as const satisfies readonly SymbolDiceFace<CrownAnchorBetKey>[]

export const FISH_PRAWN_CRAB_RULES: SymbolDiceRules<"fish-prawn-crab", FishPrawnCrabBetKey> = {
  id: "fish-prawn-crab",
  rulesVersion: "1.0.0",
  labels: { en: "Fish Prawn Crab", zh: "鱼虾蟹" },
  shortDescription: {
    en: "Three symbol dice; each matching face pays once, twice, or three times the stake.",
    zh: "掷三枚图案骰；命中一、二、三枚时分别按一、二、三倍净赢赔付。",
  },
  symbols: fishPrawnCrabSymbols,
  betOptions: fishPrawnCrabSymbols.map(({ key, labels }) => symbolBetOption(key, labels)),
}

export const CROWN_ANCHOR_RULES: SymbolDiceRules<"crown-anchor", CrownAnchorBetKey> = {
  id: "crown-anchor",
  rulesVersion: "1.0.0",
  labels: { en: "Crown and Anchor", zh: "皇冠与船锚" },
  shortDescription: {
    en: "The British symbol-dice classic with a payout for every matching die.",
    zh: "英国经典图案骰玩法，每一枚命中的骰子都会产生一次净赢。",
  },
  symbols: crownAnchorSymbols,
  betOptions: crownAnchorSymbols.map(({ key, labels }) => symbolBetOption(key, labels)),
}

export function settleSymbolDiceRound<Id extends SymbolDiceRuleId, Key extends string>(
  rules: SymbolDiceRules<Id, Key>,
  betSnapshot: Record<string, unknown>,
  rng: RandomInt,
): RegionalSettlement<Key> {
  const allowedKeys = rules.symbols.map(({ key }) => key)
  const canonical = canonicalizeBets(rules.id, rules.rulesVersion, betSnapshot, allowedKeys)
  const symbols = [
    allowedKeys[randomIndex(rng, allowedKeys.length)],
    allowedKeys[randomIndex(rng, allowedKeys.length)],
    allowedKeys[randomIndex(rng, allowedKeys.length)],
  ] as const
  const counts = Object.fromEntries(allowedKeys.map((key) => [
    key,
    symbols.filter((symbol) => symbol === key).length,
  ])) as Record<Key, number>
  const delta = money(canonical.bets.reduce((sum, bet) => {
    const matches = counts[bet.key]
    return sum + (matches > 0 ? bet.amount * matches : -bet.amount)
  }, 0))

  return {
    outcome: settlementOutcome(delta),
    delta,
    totalStake: canonical.totalStake,
    summary: `${rules.labels.en} ${symbols.join(" / ")}; ${delta >= 0 ? "+" : ""}${delta}`,
    rulesVersion: rules.rulesVersion,
    betSnapshot: canonical,
    resultSnapshot: {
      ruleSet: rules.id,
      rulesVersion: rules.rulesVersion,
      symbols,
      counts,
      rng: "server:randomInt",
    },
  }
}
