import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { enforceRateLimit } from "@/lib/rate-limit"
import { createSupabaseAuthClient, isSupabaseAuthConfigured } from "@/lib/server-auth"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ACCEPTED_MESSAGE = "If an account exists for this email, a password reset link is on its way."

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; captchaToken?: unknown } | null
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const captchaToken = typeof body?.captchaToken === "string" ? body.captchaToken.trim() : ""

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
  }

  if (!captchaToken) {
    return NextResponse.json({ error: "Please complete the security check." }, { status: 400 })
  }

  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      { error: "Password recovery is not configured." },
      { status: 501, headers: { "cache-control": "private, no-store" } },
    )
  }

  const limited = await enforceRateLimit(request, "auth.password-reset-request", { identifiers: [email] })
  if (limited) return limited

  const response = NextResponse.json(
    { message: ACCEPTED_MESSAGE },
    { status: 202, headers: { "cache-control": "private, no-store" } },
  )
  const cookieStore = await cookies()
  const supabase = createSupabaseAuthClient(cookieStore, response)
  const origin = new URL(request.url).origin

  // The response stays identical for known and unknown addresses to prevent account enumeration.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    captchaToken,
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  })

  if (error) {
    return NextResponse.json(
      { error: "The reset email could not be sent. Please wait a moment and try again." },
      { status: 502, headers: response.headers },
    )
  }

  return response
}
