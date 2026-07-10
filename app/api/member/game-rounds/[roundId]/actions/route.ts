import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { applyBlackjackRoundAction, isSameOriginMutation, memberDataErrorStatus } from "@/lib/member-data"
import { createRequestObserver } from "@/lib/observability"
import { enforceRateLimit, recordSecuritySignal } from "@/lib/rate-limit"

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ roundId: string }>
  },
) {
  const { roundId } = await params
  const observer = createRequestObserver(request, {
    flow: "blackjack_action",
    route: "/api/member/game-rounds/[roundId]/actions",
  })

  if (!isSameOriginMutation(request)) {
    observer.reject("blackjack_action.rejected", { status: 403, roundId, reasonCode: "cross_origin" })
    return observer.attach(NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 }))
  }

  const response = NextResponse.json(
    { blackjackRound: null },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  observer.info("blackjack_action.started", {
    roundId,
    action: body?.action,
    expectedVersion: body?.expectedVersion,
  })
  const limited = await enforceRateLimit(request, "member.game-rounds", {
    identifiers: [roundId, body?.action],
    requestId: observer.requestId,
  })
  if (limited) {
    observer.reject("blackjack_action.blocked", {
      roundId,
      status: limited.status,
      reasonCode: limited.status === 429 ? "rate_limit_exceeded" : "rate_limit_unavailable",
    })
    return observer.attach(limited)
  }

  try {
    const result = await applyBlackjackRoundAction(cookieStore, response, roundId, body)

    if (!result) {
      observer.reject("blackjack_action.rejected", { status: 401, roundId, reasonCode: "auth_required" })
      return observer.attach(NextResponse.json(
        { error: "Authentication is required." },
        {
          status: 401,
          headers: response.headers,
        },
      ))
    }

    if (result.idempotent) {
      await recordSecuritySignal(request, "member.game-rounds", "replayed_idempotency_key", [
        body?.commandId,
        roundId,
      ], observer.requestId)
    }

    observer.success("blackjack_action.succeeded", {
      roundId,
      action: body?.action,
      idempotent: result.idempotent,
      status: 200,
      phase: result.blackjackRound.phase,
    })

    return observer.attach(NextResponse.json(
      result,
      {
        headers: response.headers,
      },
    ))
  } catch (error) {
    const status = memberDataErrorStatus(error)
    observer.failure("blackjack_action.failed", error, {
      roundId,
      status,
      reasonCode: "blackjack_action_failed",
    })
    return observer.attach(NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to apply blackjack action." },
      {
        status,
        headers: response.headers,
      },
    ))
  }
}
