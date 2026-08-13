export type RandomInt = (max: number) => number

export type SettlementOutcome = "win" | "loss" | "push"

export interface LocalizedText {
  en: string
  zh: string
}

export interface NetOddsRange {
  min: number
  max: number
}

export interface BetOptionMetadata<Key extends string = string> {
  key: Key
  labels: LocalizedText
  netOdds: NetOddsRange
  probability: number
  expectedValue: number
}

export interface GameRuleMetadata<Id extends string = string, Key extends string = string> {
  id: Id
  rulesVersion: string
  labels: LocalizedText
  shortDescription: LocalizedText
  betOptions: readonly BetOptionMetadata<Key>[]
}

export interface CanonicalBet<Key extends string = string> {
  key: Key
  amount: number
}

export interface CanonicalBetSnapshot<Key extends string = string> extends Record<string, unknown> {
  ruleSet: string
  rulesVersion: string
  bets: CanonicalBet<Key>[]
  totalStake: number
}

export interface RegionalSettlement<Key extends string = string> {
  outcome: SettlementOutcome
  delta: number
  totalStake: number
  summary: string
  rulesVersion: string
  betSnapshot: CanonicalBetSnapshot<Key>
  resultSnapshot: Record<string, unknown>
}
