import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { Provider } from "@supabase/supabase-js"

import { createSupabaseAuthClient, isSupabaseAuthConfigured } from "@/lib/server-auth"
import { enforceRateLimit } from "@/lib/rate-limit"
import { resolveAppRedirectTarget } from "@/lib/redirect-target"

const providerMap = {
  google: "google",
  apple: "apple",
  microsoft: "azure",
  facebook: "facebook",
  x: "x",
} satisfies Record<string, Provider>

async function createOAuthRedirect(
  request: Request,
  providerKey: string,
  nextTarget: unknown,
  consent: { termsAccepted: boolean; ageAttested: boolean; locale: string },
) {
  const limited = await enforceRateLimit(request, "auth.oauth", { identifiers: [providerKey] })
  if (limited) return { limited }

  if (!isSupabaseAuthConfigured()) {
    return { error: "Supabase authentication is not configured.", status: 501 }
  }

  const provider = providerMap[providerKey as keyof typeof providerMap]

  if (!provider) {
    return { error: "Unsupported sign-in provider.", status: 400 }
  }
  if (!consent.termsAccepted || !consent.ageAttested) {
    return { error: "Terms, Privacy, and age eligibility acknowledgement are required.", status: 400 }
  }

  const response = NextResponse.json(
    { redirectTo: null },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()
  const supabase = createSupabaseAuthClient(cookieStore, response)
  const origin = new URL(request.url).origin
  const next = encodeURIComponent(resolveAppRedirectTarget(nextTarget))
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${next}&consent=1&locale=${encodeURIComponent(consent.locale)}`,
    },
  })

  if (error || !data.url) {
    return { error: error?.message ?? "Unable to start sign in.", status: 502 }
  }

  return { redirectTo: data.url, headers: response.headers }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const result = await createOAuthRedirect(
    request,
    requestUrl.searchParams.get("provider") ?? "",
    requestUrl.searchParams.get("next"),
    {
      termsAccepted: requestUrl.searchParams.get("termsAccepted") === "true",
      ageAttested: requestUrl.searchParams.get("ageAttested") === "true",
      locale: requestUrl.searchParams.get("locale")?.slice(0, 20) || "en",
    },
  )

  if ("error" in result) {
    const next = encodeURIComponent(resolveAppRedirectTarget(requestUrl.searchParams.get("next")))
    return NextResponse.redirect(new URL(`/login?next=${next}&authError=oauth`, requestUrl.origin), {
      headers: {
        "cache-control": "private, no-store",
      },
    })
  }

  if ("limited" in result) {
    return result.limited
  }

  return NextResponse.redirect(result.redirectTo, {
    headers: result.headers,
  })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    provider?: unknown
    next?: unknown
    termsAccepted?: unknown
    ageAttested?: unknown
    locale?: unknown
  } | null
  const providerKey = typeof body?.provider === "string" ? body.provider : ""
  const result = await createOAuthRedirect(request, providerKey, body?.next, {
    termsAccepted: body?.termsAccepted === true,
    ageAttested: body?.ageAttested === true,
    locale: typeof body?.locale === "string" ? body.locale.slice(0, 20) : "en",
  })

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  if ("limited" in result) {
    return result.limited
  }

  return NextResponse.json(
    { redirectTo: result.redirectTo },
    {
      headers: result.headers,
    },
  )
}
