import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { createPurchase, isSameOriginMutation, readMemberPurchasesView } from "@/lib/member-data"
import { enforceRateLimit } from "@/lib/rate-limit"

export async function GET() {
  const response = NextResponse.json(
    { purchases: [] },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()
  const purchases = await readMemberPurchasesView(cookieStore, response)

  if (!purchases) {
    return NextResponse.json(
      { error: "Authentication is required." },
      {
        status: 401,
        headers: response.headers,
      },
    )
  }

  return NextResponse.json(
    { purchases },
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
    { purchase: null },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const limited = await enforceRateLimit(request, "member.purchases", { identifiers: [body?.productId] })
  if (limited) return limited

  try {
    const purchase = await createPurchase(cookieStore, response, body)

    if (!purchase) {
      return NextResponse.json(
        { error: "Authentication is required." },
        {
          status: 401,
          headers: response.headers,
        },
      )
    }

    return NextResponse.json(
      { purchase },
      {
        headers: response.headers,
      },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create purchase." },
      {
        status: 400,
        headers: response.headers,
      },
    )
  }
}
