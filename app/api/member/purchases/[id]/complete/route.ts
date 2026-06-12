import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { completePurchase, isSameOriginMutation } from "@/lib/member-data"
import { enforceRateLimit } from "@/lib/rate-limit"

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
    { purchase: null },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()
  const limited = await enforceRateLimit(request, "member.purchase-complete", { identifiers: [id] })
  if (limited) return limited

  try {
    const result = await completePurchase(cookieStore, response, id)

    if (!result) {
      return NextResponse.json(
        { error: "Authentication is required." },
        {
          status: 401,
          headers: response.headers,
        },
      )
    }

    return NextResponse.json(
      result,
      {
        headers: response.headers,
      },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to complete purchase." },
      {
        status: 400,
        headers: response.headers,
      },
    )
  }
}
