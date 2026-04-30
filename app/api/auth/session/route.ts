import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import {
  createSessionFromSupabaseUser,
  createSupabaseAuthClient,
  isSupabaseAuthConfigured,
  MEMBER_SESSION_COOKIE,
  readSessionToken,
} from "@/lib/server-auth"

export async function GET() {
  const cookieStore = await cookies()

  if (isSupabaseAuthConfigured()) {
    const response = NextResponse.json(
      { session: null },
      {
        headers: {
          "cache-control": "private, no-store",
        },
      },
    )
    const supabase = createSupabaseAuthClient(cookieStore, response)
    const { data, error } = await supabase.auth.getUser()
    const session = error || !data.user ? null : createSessionFromSupabaseUser(data.user)

    return NextResponse.json(
      { session },
      {
        headers: response.headers,
      },
    )
  }

  const token = cookieStore.get(MEMBER_SESSION_COOKIE)?.value
  const session = (() => {
    try {
      return readSessionToken(token)
    } catch {
      return null
    }
  })()

  return NextResponse.json(
    { session },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
}
