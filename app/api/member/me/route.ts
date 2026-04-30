import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { readMemberOverview } from "@/lib/member-data"

export async function GET() {
  const response = NextResponse.json(
    { member: null },
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
    { member },
    {
      headers: response.headers,
    },
  )
}
