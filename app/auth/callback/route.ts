import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { createSupabaseAuthClient, createSupabaseServiceClient, isSupabaseAuthConfigured } from "@/lib/server-auth"
import { AGE_ATTESTATION_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal"
import { resolveAppRedirectTarget } from "@/lib/redirect-target"

function recoveryErrorUrl(origin: string) {
  return new URL("/forgot-password?error=invalid_link", origin)
}

const OAUTH_PROVIDER_KEYS = new Set(["google", "apple", "microsoft", "facebook", "x", "discord", "twitch"])

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const redirectTarget = resolveAppRedirectTarget(requestUrl.searchParams.get("next"))
  const code = requestUrl.searchParams.get("code")
  const providerError = requestUrl.searchParams.get("error")
  const providerErrorCode = requestUrl.searchParams.get("error_code")
  const requestedProvider = requestUrl.searchParams.get("provider")?.slice(0, 40) ?? ""
  const provider = OAUTH_PROVIDER_KEYS.has(requestedProvider) ? requestedProvider : ""
  const isPasswordRecovery = redirectTarget === "/reset-password"

  function loginErrorUrl(authError: string) {
    const url = new URL("/login", requestUrl.origin)
    url.searchParams.set("next", redirectTarget)
    url.searchParams.set("authError", authError)
    if (provider) url.searchParams.set("provider", provider)
    return url
  }

  if (providerError || providerErrorCode) {
    if (isPasswordRecovery) {
      return NextResponse.redirect(recoveryErrorUrl(requestUrl.origin))
    }
    if (!provider) {
      return NextResponse.redirect(loginErrorUrl("invalid_link"))
    }
    const authError = providerError === "access_denied" || providerErrorCode === "access_denied"
      ? "provider_denied"
      : "callback_failed"
    return NextResponse.redirect(loginErrorUrl(authError))
  }

  if (!isSupabaseAuthConfigured() || !code) {
    if (isPasswordRecovery) {
      return NextResponse.redirect(recoveryErrorUrl(requestUrl.origin))
    }
    return NextResponse.redirect(loginErrorUrl("invalid_link"))
  }

  const response = NextResponse.redirect(new URL(redirectTarget, requestUrl.origin), {
    headers: {
      "cache-control": "private, no-store",
    },
  })
  const cookieStore = await cookies()
  const supabase = createSupabaseAuthClient(cookieStore, response)
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    if (isPasswordRecovery) {
      return NextResponse.redirect(recoveryErrorUrl(requestUrl.origin))
    }
    return NextResponse.redirect(loginErrorUrl("oauth"))
  }

  if (requestUrl.searchParams.get("consent") === "1" && data.user) {
    try {
      const service = createSupabaseServiceClient()
      const { error: consentError } = await service.from("member_consents").upsert(
        {
          user_id: data.user.id,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
          age_attestation_version: AGE_ATTESTATION_VERSION,
          age_attested: true,
          locale: requestUrl.searchParams.get("locale")?.slice(0, 20) || "en",
          source: "oauth",
        },
        { onConflict: "user_id,terms_version,privacy_version,age_attestation_version" },
      )
      if (consentError) throw consentError
    } catch {
      const signOutResult = await supabase.auth.signOut({ scope: "local" }).catch(() => ({
        error: new Error("Unable to revoke the local OAuth session."),
      }))
      if (signOutResult.error) {
        console.warn("OAuth consent cleanup is forcing local cookie expiry.")
      }

      const consentFailure = NextResponse.redirect(loginErrorUrl("consent"), {
        headers: { "cache-control": "private, no-store" },
      })
      const responseCookies = response.cookies.getAll()
      const supabaseCookieNames = new Set([
        ...cookieStore.getAll().map(({ name }) => name),
        ...responseCookies.map(({ name }) => name),
      ].filter((name) => name.startsWith("sb-")))

      for (const cookie of responseCookies) {
        if (!cookie.name.startsWith("sb-")) consentFailure.cookies.set(cookie)
      }
      for (const name of supabaseCookieNames) {
        consentFailure.cookies.set({
          name,
          value: "",
          expires: new Date(0),
          maxAge: 0,
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        })
      }
      return consentFailure
    }
  }

  return response
}
