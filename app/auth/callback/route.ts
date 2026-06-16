import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { createSupabaseAuthClient, createSupabaseServiceClient, isSupabaseAuthConfigured } from "@/lib/server-auth"
import { AGE_ATTESTATION_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal"

function resolveRedirectTarget(nextTarget: string | null) {
  if (!nextTarget?.startsWith("/")) {
    return "/"
  }

  return nextTarget.startsWith("//") ? "/" : nextTarget
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const redirectTarget = resolveRedirectTarget(requestUrl.searchParams.get("next"))
  const code = requestUrl.searchParams.get("code")

  if (!isSupabaseAuthConfigured() || !code) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(redirectTarget)}`, requestUrl.origin))
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
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(redirectTarget)}&authError=oauth`, requestUrl.origin),
    )
  }

  if (requestUrl.searchParams.get("consent") === "1" && data.user) {
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
    if (consentError) {
      return NextResponse.redirect(
        new URL(`/login?next=${encodeURIComponent(redirectTarget)}&authError=consent`, requestUrl.origin),
      )
    }
  }

  return response
}
