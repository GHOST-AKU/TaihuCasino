export interface ClientGameRoundInput {
  gameSlug: string
  idempotencyKey: string
  tableSessionId: string
  betSnapshot: Record<string, unknown>
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
  } | null

  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to record game round.")
  }

  return typeof payload?.progress?.bankroll === "number" ? payload.progress.bankroll : null
}
