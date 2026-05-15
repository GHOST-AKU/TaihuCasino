import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { createPurchase, isSameOriginMutation, readMemberOverview } from "@/lib/member-data"

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
    { purchases: member.purchases },
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

  try {
    const purchase = await createPurchase(cookieStore, response, await request.json().catch(() => null))

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
