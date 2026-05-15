import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { completeAdReward, isSameOriginMutation } from "@/lib/member-data"

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 })
  }

  const response = NextResponse.json(
    { adReward: null },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()

  try {
    const result = await completeAdReward(cookieStore, response, await request.json().catch(() => null))

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
      { error: error instanceof Error ? error.message : "Unable to complete ad reward." },
      {
        status: 400,
        headers: response.headers,
      },
    )
  }
}
