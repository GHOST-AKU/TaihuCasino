import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { cashOutTableSession, isSameOriginMutation } from "@/lib/member-data"
import { enforceRateLimit, recordSecuritySignal } from "@/lib/rate-limit"

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>
  },
) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 })
  }

  const { id } = await params
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
  const limited = await enforceRateLimit(request, "member.cash-out", { identifiers: [id] })
  if (limited) return limited

  try {
    const result = await cashOutTableSession(cookieStore, response, id, body)

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
      await recordSecuritySignal(request, "member.cash-out", "replayed_idempotency_key", [id])
    }

    return NextResponse.json(
      result,
      {
        headers: response.headers,
      },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to cash out table session." },
      {
        status: 400,
        headers: response.headers,
      },
    )
  }
}
