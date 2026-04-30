import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { Provider } from "@supabase/supabase-js"

import { createSupabaseAuthClient, isSupabaseAuthConfigured } from "@/lib/server-auth"

const providerMap = {
  google: "google",
  apple: "apple",
  microsoft: "azure",
  facebook: "facebook",
  x: "x",
} satisfies Record<string, Provider>

function resolveRedirectTarget(nextTarget: unknown) {
  return typeof nextTarget === "string" && nextTarget.startsWith("/") ? nextTarget : "/"
}

export async function POST(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json({ error: "Supabase authentication is not configured." }, { status: 501 })
  }

  const body = (await request.json().catch(() => null)) as {
    provider?: unknown
    next?: unknown
  } | null
  const providerKey = typeof body?.provider === "string" ? body.provider : ""
  const provider = providerMap[providerKey as keyof typeof providerMap]

  if (!provider) {
    return NextResponse.json({ error: "Unsupported sign-in provider." }, { status: 400 })
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
  const next = encodeURIComponent(resolveRedirectTarget(body?.next))
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${next}`,
    },
  })

  if (error || !data.url) {
    return NextResponse.json({ error: error?.message ?? "Unable to start sign in." }, { status: 502 })
  }

  return NextResponse.json(
    { redirectTo: data.url },
    {
      headers: response.headers,
    },
  )
}
