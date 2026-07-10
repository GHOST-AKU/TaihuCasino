export type RoundOutcome = "win" | "loss" | "push"
export type RoundStatus = "settled" | "rejected" | "voided"

export interface RoundEnvelope<TResult extends Record<string, unknown> = Record<string, unknown>> {
  roundId: string
  gameSlug: string
  tableSessionId: string
  status: RoundStatus
  version: 1
  outcome: RoundOutcome
  delta: number
  totalStake: number
  chipBalanceBefore: number
  chipBalanceAvailable: number
  chipBalanceAfter: number
  summary: string
  betSnapshot: Record<string, unknown>
  resultSnapshot: TResult
  serverTimestamp: string
  idempotent: boolean
}
