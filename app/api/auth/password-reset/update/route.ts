import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { enforceRateLimit } from "@/lib/rate-limit"
import { isSameOriginRequest } from "@/lib/request-origin"
import { createSupabaseAuthClient, isSupabaseAuthConfigured } from "@/lib/server-auth"

const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 1024

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null
  const password = typeof body?.password === "string" ? body.password : ""

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "Password is too long." }, { status: 400 })
  }
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      { error: "Password recovery is not configured." },
      { status: 501, headers: { "cache-control": "private, no-store" } },
    )
  }

  const limited = await enforceRateLimit(request, "auth.password-reset-update")
  if (limited) return limited

  const response = NextResponse.json(
    { updated: true },
    { headers: { "cache-control": "private, no-store" } },
  )
  const cookieStore = await cookies()
  const supabase = createSupabaseAuthClient(cookieStore, response)
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "This password reset link is invalid or has expired." },
      { status: 401, headers: response.headers },
    )
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    return NextResponse.json(
      { error: "Password could not be updated. Choose a different password and try again." },
      { status: 400, headers: response.headers },
    )
  }

  await supabase.auth.signOut({ scope: "global" })
  return response
}
