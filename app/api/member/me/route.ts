import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { readMemberLobbyOverview, readMemberOverview, toMemberHomeSnapshot } from "@/lib/member-data"

export async function GET(request: Request) {
  const response = NextResponse.json(
    { member: null },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()
  const scope = new URL(request.url).searchParams.get("scope")
  const member = scope === "lobby"
    ? await readMemberLobbyOverview(cookieStore, response)
    : await readMemberOverview(cookieStore, response)

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
    { member: scope === "lobby" ? toMemberHomeSnapshot(member) : member },
    {
      headers: response.headers,
    },
  )
}
