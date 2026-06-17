import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { isSameOriginMutation, openTableSession } from "@/lib/member-data"
import { createRequestObserver } from "@/lib/observability"
import { enforceRateLimit, recordSecuritySignal } from "@/lib/rate-limit"

export async function POST(request: Request) {
  const observer = createRequestObserver(request, { flow: "table_session", route: "/api/member/table-sessions" })

  if (!isSameOriginMutation(request)) {
    observer.reject("table_session.open.rejected", { status: 403, reasonCode: "cross_origin" })
    return observer.attach(NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 }))
  }

  const response = NextResponse.json(
    { tableSession: null },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()
  const contentType = request.headers.get("content-type") ?? ""
  const acceptsHtml = request.headers.get("accept")?.includes("text/html") ?? false
  const body = contentType.includes("application/json")
    ? await request.json().catch(() => null)
    : contentType.includes("form")
      ? Object.fromEntries((await request.formData()).entries())
      : null
  const gameSlug = body && typeof body === "object" ? (body as Record<string, unknown>).gameSlug : ""
  observer.info("table_session.open.started", { gameSlug })
  const limited = await enforceRateLimit(request, "member.table-sessions", {
    identifiers: [gameSlug],
    requestId: observer.requestId,
  })
  if (limited) {
    observer.reject("table_session.open.blocked", {
      gameSlug,
      status: limited.status,
      reasonCode: limited.status === 429 ? "rate_limit_exceeded" : "rate_limit_unavailable",
    })
    return observer.attach(limited)
  }

  try {
    const result = await openTableSession(cookieStore, response, body)

    if (!result) {
      observer.reject("table_session.open.rejected", { gameSlug, status: 401, reasonCode: "auth_required" })
      if (acceptsHtml) {
        return observer.attach(NextResponse.redirect(new URL("/login?next=/games/baccarat", request.url), {
          status: 303,
          headers: response.headers,
        }))
      }

      return observer.attach(NextResponse.json(
        { error: "Authentication is required." },
        {
          status: 401,
          headers: response.headers,
        },
      ))
    }

    if (result.idempotent) {
      await recordSecuritySignal(
        request,
        "member.table-sessions",
        "replayed_idempotency_key",
        [],
        observer.requestId,
      )
    }
    observer.success("table_session.open.succeeded", {
      gameSlug: result.tableSession.gameSlug,
      idempotent: result.idempotent,
      status: acceptsHtml ? 303 : 200,
      tableSessionId: result.tableSession.id,
    })

    if (acceptsHtml) {
      return observer.attach(NextResponse.redirect(new URL(`/games/${result.tableSession.gameSlug}`, request.url), {
        status: 303,
        headers: response.headers,
      }))
    }

    return observer.attach(NextResponse.json(result, { headers: response.headers }))
  } catch (error) {
    observer.failure("table_session.open.failed", error, {
      gameSlug,
      status: 400,
      reasonCode: "table_session_open_failed",
    })
    if (acceptsHtml) {
      return observer.attach(NextResponse.redirect(new URL("/games/baccarat?buyIn=error", request.url), {
        status: 303,
        headers: response.headers,
      }))
    }

    return observer.attach(NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open table session." },
      {
        status: 400,
        headers: response.headers,
      },
    ))
  }
}
