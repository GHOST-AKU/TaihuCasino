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
  discord: "discord",
  twitch: "twitch",
} satisfies Record<string, Provider>

function isOAuthProviderKey(providerKey: string): providerKey is keyof typeof providerMap {
  return Object.hasOwn(providerMap, providerKey)
}

async function createOAuthRedirect(
  request: Request,
  providerKey: string,
  nextTarget: unknown,
  consent: { termsAccepted: boolean; ageAttested: boolean; locale: string },
) {
  const limited = await enforceRateLimit(request, "auth.oauth", { identifiers: [providerKey] })
  if (limited) return { limited }

  if (!isSupabaseAuthConfigured()) {
    return { error: "Social sign-in is not configured.", errorCode: "oauth_unavailable", status: 501 }
  }

  if (!isOAuthProviderKey(providerKey)) {
    return { error: "Unsupported sign-in provider.", errorCode: "unsupported_provider", status: 400 }
  }
  const provider = providerMap[providerKey]
  if (!consent.termsAccepted || !consent.ageAttested) {
    return {
      error: "Terms, Privacy, and age eligibility acknowledgement are required.",
      errorCode: "consent_required",
      status: 400,
    }
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
  const callbackUrl = new URL("/auth/callback", origin)
  callbackUrl.searchParams.set("next", resolveAppRedirectTarget(nextTarget))
  callbackUrl.searchParams.set("consent", "1")
  callbackUrl.searchParams.set("locale", consent.locale)
  callbackUrl.searchParams.set("provider", providerKey)
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl.toString(),
    },
  })

  if (error || !data.url) {
    return {
      error: error?.message ?? "Unable to start sign in.",
      errorCode: "provider_unavailable",
      status: 502,
    }
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
    const params = new URLSearchParams({
      next: resolveAppRedirectTarget(requestUrl.searchParams.get("next")),
      authError: result.errorCode ?? "oauth",
    })
    const providerKey = requestUrl.searchParams.get("provider") ?? ""
    if (isOAuthProviderKey(providerKey)) params.set("provider", providerKey)
    return NextResponse.redirect(new URL(`/login?${params.toString()}`, requestUrl.origin), {
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
    return NextResponse.json({ error: result.error, code: result.errorCode }, { status: result.status })
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
