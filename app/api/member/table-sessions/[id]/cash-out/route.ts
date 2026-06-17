import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { cashOutTableSession, isSameOriginMutation } from "@/lib/member-data"
import { createRequestObserver } from "@/lib/observability"
import { enforceRateLimit, recordSecuritySignal } from "@/lib/rate-limit"

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>
  },
) {
  const observer = createRequestObserver(request, {
    flow: "cash_out",
    route: "/api/member/table-sessions/[id]/cash-out",
  })

  if (!isSameOriginMutation(request)) {
    observer.reject("cash_out.rejected", { status: 403, reasonCode: "cross_origin" })
    return observer.attach(NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 }))
  }

  const { id } = await params
  observer.info("cash_out.started", { tableSessionId: id })
  const response = NextResponse.json(
    { tableSession: null },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()
  const body = await request.json().catch(() => null)
  const limited = await enforceRateLimit(request, "member.cash-out", {
    identifiers: [id],
    requestId: observer.requestId,
  })
  if (limited) {
    observer.reject("cash_out.blocked", {
      status: limited.status,
      tableSessionId: id,
      reasonCode: limited.status === 429 ? "rate_limit_exceeded" : "rate_limit_unavailable",
    })
    return observer.attach(limited)
  }

  try {
    const result = await cashOutTableSession(cookieStore, response, id, body)

    if (!result) {
      observer.reject("cash_out.rejected", { status: 401, tableSessionId: id, reasonCode: "auth_required" })
      return observer.attach(NextResponse.json(
        { error: "Authentication is required." },
        {
          status: 401,
          headers: response.headers,
        },
      ))
    }

    if (result.idempotent) {
      await recordSecuritySignal(request, "member.cash-out", "replayed_idempotency_key", [id], observer.requestId)
    }
    observer.success("cash_out.succeeded", {
      gameSlug: result.tableSession.gameSlug,
      idempotent: result.idempotent,
      status: 200,
      tableSessionId: id,
    })

    return observer.attach(NextResponse.json(
      result,
      {
        headers: response.headers,
      },
    ))
  } catch (error) {
    observer.failure("cash_out.failed", error, {
      status: 400,
      tableSessionId: id,
      reasonCode: "cash_out_failed",
    })
    return observer.attach(NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to cash out table session." },
      {
        status: 400,
        headers: response.headers,
      },
    ))
  }
}
