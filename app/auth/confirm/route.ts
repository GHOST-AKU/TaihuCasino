import type { EmailOtpType } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { createSupabaseAuthClient, isSupabaseAuthConfigured } from "@/lib/server-auth"

function recoveryErrorUrl(origin: string) {
  return new URL("/forgot-password?error=invalid_link", origin)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const tokenHash = requestUrl.searchParams.get("token_hash")
  const type = requestUrl.searchParams.get("type")

  if (!isSupabaseAuthConfigured() || !tokenHash || type !== "recovery") {
    return NextResponse.redirect(recoveryErrorUrl(requestUrl.origin))
  }

  const response = NextResponse.redirect(new URL("/reset-password", requestUrl.origin), {
    headers: { "cache-control": "private, no-store" },
  })
  const supabase = createSupabaseAuthClient(await cookies(), response)
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  })

  return error ? NextResponse.redirect(recoveryErrorUrl(requestUrl.origin)) : response
}
