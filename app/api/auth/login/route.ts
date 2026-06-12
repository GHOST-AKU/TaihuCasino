import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import {
  MEMBER_SESSION_COOKIE,
  assertSupabaseAuthConfigured,
  createSessionToken,
  createSessionFromSupabaseUser,
  createSupabaseAuthClient,
  getSessionCookieOptions,
  isSupabaseAuthConfigured,
  validateCredentials,
} from "@/lib/server-auth"
import { enforceRateLimit } from "@/lib/rate-limit"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    account?: unknown
    password?: unknown
  } | null

  const account = typeof body?.account === "string" ? body.account.trim() : ""
  const password = typeof body?.password === "string" ? body.password : ""

  if (!account || !password) {
    return NextResponse.json({ error: "Account and password are required." }, { status: 400 })
  }

  const limited = await enforceRateLimit(request, "auth.login", { identifiers: [account] })
  if (limited) return limited

  if (isSupabaseAuthConfigured()) {
    try {
      assertSupabaseAuthConfigured()

      const response = NextResponse.json(
        { session: null },
        {
          headers: {
            "cache-control": "private, no-store",
          },
        },
      )
      const cookieStore = await cookies()
      const supabase = createSupabaseAuthClient(cookieStore, response)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: account,
        password,
      })

      if (error || !data.user) {
        const failureLimited = await enforceRateLimit(request, "auth.login.failure", {
          auditAllowed: true,
          identifiers: [account],
          reason: "invalid_credentials",
        })
        if (failureLimited) return failureLimited
        return NextResponse.json({ error: "Invalid account or password." }, { status: 401 })
      }

      const session = createSessionFromSupabaseUser(data.user)

      return NextResponse.json(
        { session },
        {
          headers: response.headers,
        },
      )
    } catch {
      return NextResponse.json({ error: "Supabase authentication is not configured correctly." }, { status: 500 })
    }
  }

  let session
  let token

  try {
    session = validateCredentials(account, password)
    token = session ? createSessionToken(session) : null
  } catch {
    return NextResponse.json({ error: "Authentication is not configured correctly." }, { status: 500 })
  }

  if (!session || !token) {
    const failureLimited = await enforceRateLimit(request, "auth.login.failure", {
      auditAllowed: true,
      identifiers: [account],
      reason: "invalid_credentials",
    })
    if (failureLimited) return failureLimited
    return NextResponse.json({ error: "Invalid account or password." }, { status: 401 })
  }

  const response = NextResponse.json(
    { session },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  response.cookies.set(MEMBER_SESSION_COOKIE, token, getSessionCookieOptions())

  return response
}
