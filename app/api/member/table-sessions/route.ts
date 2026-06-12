import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { isSameOriginMutation, openTableSession } from "@/lib/member-data"
import { enforceRateLimit, recordSecuritySignal } from "@/lib/rate-limit"

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 })
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
  const limited = await enforceRateLimit(request, "member.table-sessions", {
    identifiers: [body && typeof body === "object" ? (body as Record<string, unknown>).gameSlug : ""],
  })
  if (limited) return limited

  try {
    const result = await openTableSession(cookieStore, response, body)

    if (!result) {
      if (acceptsHtml) {
        return NextResponse.redirect(new URL("/login?next=/games/baccarat", request.url), {
          status: 303,
          headers: response.headers,
        })
      }

      return NextResponse.json(
        { error: "Authentication is required." },
        {
          status: 401,
          headers: response.headers,
        },
      )
    }

    if (result.idempotent) {
      await recordSecuritySignal(request, "member.table-sessions", "replayed_idempotency_key")
    }

    if (acceptsHtml) {
      return NextResponse.redirect(new URL(`/games/${result.tableSession.gameSlug}`, request.url), {
        status: 303,
        headers: response.headers,
      })
    }

    return NextResponse.json(
      result,
      {
        headers: response.headers,
      },
    )
  } catch (error) {
    if (acceptsHtml) {
      return NextResponse.redirect(new URL("/games/baccarat?buyIn=error", request.url), {
        status: 303,
        headers: response.headers,
      })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open table session." },
      {
        status: 400,
        headers: response.headers,
      },
    )
  }
}
