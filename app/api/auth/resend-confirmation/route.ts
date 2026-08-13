import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { enforceRateLimit } from "@/lib/rate-limit"
import { resolveAppRedirectTarget } from "@/lib/redirect-target"
import { createSupabaseAuthClient, isSupabaseAuthConfigured } from "@/lib/server-auth"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ACCEPTED_MESSAGE =
  "If a pending account exists for this email, a fresh confirmation link is on its way. Check your spam folder before requesting another."

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown
    captchaToken?: unknown
    next?: unknown
  } | null
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const captchaToken = typeof body?.captchaToken === "string" ? body.captchaToken.trim() : ""

  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    return NextResponse.json(
      { error: "Enter the email address used to create your account." },
      { status: 400, headers: { "cache-control": "private, no-store" } },
    )
  }

  if (!captchaToken) {
    return NextResponse.json(
      { error: "Please complete the security check." },
      { status: 400, headers: { "cache-control": "private, no-store" } },
    )
  }

  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      { error: "Confirmation email delivery is not configured yet." },
      { status: 501, headers: { "cache-control": "private, no-store" } },
    )
  }

  const limited = await enforceRateLimit(request, "auth.email-confirmation-resend", { identifiers: [email] })
  if (limited) return limited

  const response = NextResponse.json(
    { message: ACCEPTED_MESSAGE },
    { status: 202, headers: { "cache-control": "private, no-store" } },
  )
  const cookieStore = await cookies()
  const supabase = createSupabaseAuthClient(cookieStore, response)
  const origin = new URL(request.url).origin
  const callbackUrl = new URL("/auth/callback", origin)
  callbackUrl.searchParams.set("next", resolveAppRedirectTarget(body?.next))

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      captchaToken,
      emailRedirectTo: callbackUrl.toString(),
    },
  })

  if (error) {
    const providerLimited = error.status === 429 || /rate.?limit|security purposes|only request/i.test(error.message)
    if (providerLimited) {
      // Provider throttling can reveal whether a pending identity exists. The
      // pre-provider local limiter is the only client-visible 429 boundary.
      return response
    }

    if (error.code === "captcha_failed" || /captcha/i.test(error.message)) {
      return NextResponse.json(
        { error: "The security check expired or could not be verified. Complete it again." },
        { status: 400, headers: response.headers },
      )
    }

    if ((error.status ?? 500) >= 500) {
      return NextResponse.json(
        { error: "The confirmation email service is temporarily unavailable. Please try again later." },
        { status: 502, headers: response.headers },
      )
    }

    // Identity-dependent responses (unknown or already-confirmed email) stay indistinguishable.
    return response
  }

  return response
}
