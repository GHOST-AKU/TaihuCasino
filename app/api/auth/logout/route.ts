import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { MEMBER_STATE_COOKIE } from "@/lib/member-data"
import { createSupabaseAuthClient, isSupabaseAuthConfigured, MEMBER_SESSION_COOKIE } from "@/lib/server-auth"

export async function POST() {
  const response = NextResponse.json(
    { ok: true },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )

  if (isSupabaseAuthConfigured()) {
    const cookieStore = await cookies()
    const supabase = createSupabaseAuthClient(cookieStore, response)
    await supabase.auth.signOut()
  }

  response.cookies.set(MEMBER_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
  response.cookies.set(MEMBER_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })

  return response
}
