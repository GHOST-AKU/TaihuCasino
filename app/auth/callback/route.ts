import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { createSupabaseAuthClient, isSupabaseAuthConfigured } from "@/lib/server-auth"

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
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(redirectTarget)}&authError=oauth`, requestUrl.origin),
    )
  }

  return response
}
