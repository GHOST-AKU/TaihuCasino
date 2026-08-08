import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { isSameOriginMutation, readMemberEventsView, recordMemberEvent } from "@/lib/member-data"

export async function GET() {
  const response = NextResponse.json(
    { events: [] },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()
  const events = await readMemberEventsView(cookieStore, response)

  if (!events) {
    return NextResponse.json(
      { error: "Authentication is required." },
      {
        status: 401,
        headers: response.headers,
      },
    )
  }

  return NextResponse.json(
    { events },
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
    { event: null },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()

  try {
    const event = await recordMemberEvent(cookieStore, response, await request.json().catch(() => null))

    if (!event) {
      return NextResponse.json(
        { error: "Authentication is required." },
        {
          status: 401,
          headers: response.headers,
        },
      )
    }

    return NextResponse.json(
      { event },
      {
        headers: response.headers,
      },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to record member event." },
      {
        status: 400,
        headers: response.headers,
      },
    )
  }
}
