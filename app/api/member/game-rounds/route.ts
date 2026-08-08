import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { isSameOriginMutation, memberDataErrorStatus, readMemberGameHistory, recordGameProgress } from "@/lib/member-data"
import { createRequestObserver } from "@/lib/observability"
import { enforceRateLimit, recordSecuritySignal } from "@/lib/rate-limit"

export async function GET() {
  const response = NextResponse.json(
    { rounds: [] },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()
  const history = await readMemberGameHistory(cookieStore, response)

  if (!history) {
    return NextResponse.json(
      { error: "Authentication is required." },
      {
        status: 401,
        headers: response.headers,
      },
    )
  }

  return NextResponse.json(
    { rounds: history.gameRounds, progress: history.progress },
    {
      headers: response.headers,
    },
  )
}

export async function POST(request: Request) {
  const observer = createRequestObserver(request, { flow: "game_round", route: "/api/member/game-rounds" })

  if (!isSameOriginMutation(request)) {
    observer.reject("game_round.settle.rejected", { status: 403, reasonCode: "cross_origin" })
    return observer.attach(NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 }))
  }

  const response = NextResponse.json(
    { progress: null },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  observer.info("game_round.settle.started", {
    gameSlug: body?.gameSlug,
    tableSessionId: body?.tableSessionId,
  })
  const limited = await enforceRateLimit(request, "member.game-rounds", {
    identifiers: [body?.gameSlug, body?.tableSessionId],
    requestId: observer.requestId,
  })
  if (limited) {
    observer.reject("game_round.settle.blocked", {
      gameSlug: body?.gameSlug,
      status: limited.status,
      tableSessionId: body?.tableSessionId,
      reasonCode: limited.status === 429 ? "rate_limit_exceeded" : "rate_limit_unavailable",
    })
    return observer.attach(limited)
  }

  try {
    const result = await recordGameProgress(cookieStore, response, body)

    if (!result) {
      observer.reject("game_round.settle.rejected", {
        gameSlug: body?.gameSlug,
        status: 401,
        tableSessionId: body?.tableSessionId,
        reasonCode: "auth_required",
      })
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
        body?.idempotencyKey,
        body?.tableSessionId,
      ], observer.requestId)
    }
    const blackjackRound = "blackjackRound" in result ? result.blackjackRound : null
    observer.success("game_round.settle.succeeded", {
      gameSlug: body?.gameSlug,
      idempotent: result.idempotent,
      outcome: result.settlement?.outcome ?? blackjackRound?.phase,
      status: 200,
      tableSessionId: body?.tableSessionId,
    })

    return observer.attach(NextResponse.json(
      result,
      {
        headers: response.headers,
      },
    ))
  } catch (error) {
    const status = memberDataErrorStatus(error)
    observer.failure("game_round.settle.failed", error, {
      gameSlug: body?.gameSlug,
      status,
      tableSessionId: body?.tableSessionId,
      reasonCode: "game_round_settlement_failed",
    })
    return observer.attach(NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to record game round." },
      {
        status,
        headers: response.headers,
      },
    ))
  }
}
