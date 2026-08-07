import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import {
  createSessionFromSupabaseUser,
  createSupabaseAuthClient,
  isSupabaseAuthConfigured,
} from "@/lib/server-auth"
import { enforceRateLimit } from "@/lib/rate-limit"
import { AGE_ATTESTATION_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal"
import { resolveAppRedirectTarget } from "@/lib/redirect-target"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8
const MAX_DISPLAY_NAME_LENGTH = 60

function parseRegistrationBody(body: {
  email?: unknown
  password?: unknown
  displayName?: unknown
  captchaToken?: unknown
  next?: unknown
  termsAccepted?: unknown
  ageAttested?: unknown
  locale?: unknown
} | null) {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body?.password === "string" ? body.password : ""
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : ""
  const captchaToken = typeof body?.captchaToken === "string" ? body.captchaToken.trim() : ""
  const next = resolveAppRedirectTarget(body?.next)
  const termsAccepted = body?.termsAccepted === true
  const ageAttested = body?.ageAttested === true
  const locale = typeof body?.locale === "string" ? body.locale.trim().slice(0, 20) : "en"

  if (!EMAIL_PATTERN.test(email)) {
    return { error: "A valid email address is required." }
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: "Password must be at least 8 characters." }
  }

  if (!displayName) {
    return { error: "Player name is required." }
  }

  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return { error: "Player name must be 60 characters or fewer." }
  }

  if (!captchaToken) {
    return { error: "Please complete the security check." }
  }

  if (!termsAccepted) {
    return { error: "You must accept the Terms and Privacy framework to create an account." }
  }

  if (!ageAttested) {
    return { error: "You must confirm that you meet the age requirement for your location." }
  }

  return { data: { email, password, displayName, captchaToken, next, termsAccepted, ageAttested, locale } }
}

export async function POST(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json({ error: "Supabase authentication is not configured." }, { status: 501 })
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown
    password?: unknown
    displayName?: unknown
    captchaToken?: unknown
    next?: unknown
    termsAccepted?: unknown
    ageAttested?: unknown
    locale?: unknown
  } | null
  const parsed = parseRegistrationBody(body)

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const limited = await enforceRateLimit(request, "auth.register", { identifiers: [parsed.data.email] })
  if (limited) return limited

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
  const origin = new URL(request.url).origin
  const { email, password, displayName, captchaToken, next, ageAttested, locale } = parsed.data
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken,
      data: {
        display_name: displayName,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
        age_attestation_version: AGE_ATTESTATION_VERSION,
        age_attested: ageAttested,
        locale,
      },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })

  if (error) {
    const message = /already registered/i.test(error.message)
      ? "An account with this email already exists."
      : error.message || "Unable to create account."

    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (data.session && data.user) {
    return NextResponse.json(
      {
        confirmationRequired: false,
        session: createSessionFromSupabaseUser(data.user),
      },
      {
        headers: response.headers,
        status: 201,
      },
    )
  }

  return NextResponse.json(
    {
      confirmationRequired: true,
      session: null,
    },
    {
      headers: response.headers,
      status: 202,
    },
  )
}
