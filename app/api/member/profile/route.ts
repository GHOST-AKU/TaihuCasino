import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { isSameOriginMutation, readMemberProfileView, updateMemberProfile } from "@/lib/member-data"

export async function GET() {
  const response = NextResponse.json(
    { profile: null },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()
  const profile = await readMemberProfileView(cookieStore, response)

  if (!profile) {
    return NextResponse.json(
      { error: "Authentication is required." },
      {
        status: 401,
        headers: response.headers,
      },
    )
  }

  return NextResponse.json(
    { profile },
    {
      headers: response.headers,
    },
  )
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 })
  }

  const response = NextResponse.json(
    { profile: null },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()

  try {
    const profile = await updateMemberProfile(cookieStore, response, await request.json().catch(() => null))

    if (!profile) {
      return NextResponse.json(
        { error: "Authentication is required." },
        {
          status: 401,
          headers: response.headers,
        },
      )
    }

    return NextResponse.json(
      { profile },
      {
        headers: response.headers,
      },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update profile." },
      {
        status: 400,
        headers: response.headers,
      },
    )
  }
}
