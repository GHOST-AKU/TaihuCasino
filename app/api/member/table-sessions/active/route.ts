import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { readActiveTableSession } from "@/lib/member-data"

export async function GET(request: Request) {
  const response = NextResponse.json(
    { tableSession: null },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()
  const { searchParams } = new URL(request.url)
  const gameSlug = searchParams.get("gameSlug")?.trim() ?? ""

  if (!gameSlug) {
    return NextResponse.json(
      { error: "Game slug is required." },
      {
        status: 400,
        headers: response.headers,
      },
    )
  }

  try {
    const tableSession = await readActiveTableSession(cookieStore, gameSlug, response)

    return NextResponse.json(
      { tableSession },
      {
        headers: response.headers,
      },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read table session." },
      {
        status: 400,
        headers: response.headers,
      },
    )
  }
}
