import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { isSameOriginMutation, readMemberOverview, recordGameProgress } from "@/lib/member-data"
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
  const member = await readMemberOverview(cookieStore, response)

  if (!member) {
    return NextResponse.json(
      { error: "Authentication is required." },
      {
        status: 401,
        headers: response.headers,
      },
    )
  }

  return NextResponse.json(
    { rounds: member.gameRounds, progress: member.progress },
    {
      headers: response.headers,
    },
  )
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 })
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
  const limited = await enforceRateLimit(request, "member.game-rounds", {
    identifiers: [body?.gameSlug, body?.tableSessionId],
  })
  if (limited) return limited

  try {
    const result = await recordGameProgress(cookieStore, response, body)

    if (!result) {
      return NextResponse.json(
        { error: "Authentication is required." },
        {
          status: 401,
          headers: response.headers,
        },
      )
    }

    if (result.idempotent) {
      await recordSecuritySignal(request, "member.game-rounds", "replayed_idempotency_key", [
        body?.idempotencyKey,
        body?.tableSessionId,
      ])
    }

    return NextResponse.json(
      result,
      {
        headers: response.headers,
      },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to record game round." },
      {
        status: 400,
        headers: response.headers,
      },
    )
  }
}
