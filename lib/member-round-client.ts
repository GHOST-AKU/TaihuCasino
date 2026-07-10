import type { RoundEnvelope } from "@/lib/game-round-contract"
import type { BlackjackAction, BlackjackRoundView } from "@/lib/blackjack-engine"

export interface ClientGameRoundInput {
  gameSlug: string
  idempotencyKey: string
  tableSessionId: string
  betSnapshot: Record<string, unknown>
}

export interface ClientAuthoritativeSettlement {
  outcome: "win" | "loss" | "push"
  delta: number
  totalStake: number
  summary: string
  resultSnapshot: Record<string, unknown>
}

export async function recordClientGameRound(input: ClientGameRoundInput) {
  const response = await fetch("/api/member/game-rounds", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => null)) as {
    error?: string
    progress?: { bankroll?: unknown }
    settlement?: ClientAuthoritativeSettlement
    round?: RoundEnvelope
    blackjackRound?: BlackjackRoundView
    idempotent?: boolean
  } | null

  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to record game round.")
  }

  return {
    bankroll: typeof payload?.progress?.bankroll === "number" ? payload.progress.bankroll : null,
    settlement: payload?.settlement ?? null,
    round: payload?.round ?? null,
    blackjackRound: payload?.blackjackRound ?? null,
    idempotent: payload?.idempotent === true,
  }
}

export interface ClientBlackjackActionInput {
  commandId: string
  expectedVersion: number
  action: BlackjackAction
  handId?: string | null
}

export async function recordClientBlackjackAction(roundId: string, input: ClientBlackjackActionInput) {
  const response = await fetch(`/api/member/game-rounds/${roundId}/actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => null)) as {
    error?: string
    progress?: { bankroll?: unknown }
    settlement?: ClientAuthoritativeSettlement
    round?: RoundEnvelope
    blackjackRound?: BlackjackRoundView
    idempotent?: boolean
  } | null

  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to apply blackjack action.")
  }

  return {
    bankroll: typeof payload?.progress?.bankroll === "number" ? payload.progress.bankroll : null,
    settlement: payload?.settlement ?? null,
    round: payload?.round ?? null,
    blackjackRound: payload?.blackjackRound ?? null,
    idempotent: payload?.idempotent === true,
  }
}
