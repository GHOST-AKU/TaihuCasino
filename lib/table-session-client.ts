import { type MemberTableSession } from "@/lib/member-data"

interface TableSessionMutationPayload {
  error?: string
  tableSession?: MemberTableSession
  wallet?: {
    balance?: unknown
  }
}

export interface TableSessionMutationResult {
  tableSession: MemberTableSession
  walletBalance: number | null
}

function parseTableSessionPayload(payload: TableSessionMutationPayload | null) {
  if (!payload?.tableSession) {
    return null
  }

  return {
    tableSession: payload.tableSession,
    walletBalance: typeof payload.wallet?.balance === "number" ? payload.wallet.balance : null,
  } satisfies TableSessionMutationResult
}

export async function openClientTableSession(
  gameSlug: string,
  buyInAmount: number,
  idempotencyPrefix: string,
) {
  const response = await fetch("/api/member/table-sessions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      gameSlug,
      buyInAmount,
      idempotencyKey: `${idempotencyPrefix}-${gameSlug}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    }),
  })
  const payload = (await response.json().catch(() => null)) as TableSessionMutationPayload | null
  const parsed = parseTableSessionPayload(payload)

  if (!response.ok || !parsed) {
    throw new Error(payload?.error ?? "Unable to buy in.")
  }

  return parsed
}

export async function cashOutClientTableSession(
  sessionId: string,
  idempotencyPrefix: string,
  expectedChipBalance?: number,
) {
  const response = await fetch(`/api/member/table-sessions/${sessionId}/cash-out`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      idempotencyKey: `${idempotencyPrefix}-${sessionId}-${Date.now()}`,
      expectedChipBalance,
    }),
  })
  const payload = (await response.json().catch(() => null)) as TableSessionMutationPayload | null
  const parsed = parseTableSessionPayload(payload)

  if (!response.ok || !parsed) {
    throw new Error(payload?.error ?? "Unable to cash out.")
  }

  return parsed
}
