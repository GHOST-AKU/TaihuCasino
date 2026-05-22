import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { Provider } from "@supabase/supabase-js"

import { createSupabaseAuthClient, isSupabaseAuthConfigured } from "@/lib/server-auth"

const providerMap = {
  google: "google",
  apple: "apple",
  microsoft: "azure",
  facebook: "facebook",
  amazon: "custom:amazon",
  x: "x",
} satisfies Record<string, Provider>

function resolveRedirectTarget(nextTarget: unknown) {
  if (typeof nextTarget !== "string" || !nextTarget.startsWith("/") || nextTarget.startsWith("//")) {
    return "/"
  }

  return nextTarget
}

async function createOAuthRedirect(request: Request, providerKey: string, nextTarget: unknown) {
  if (!isSupabaseAuthConfigured()) {
    return { error: "Supabase authentication is not configured.", status: 501 }
  }

  const provider = providerMap[providerKey as keyof typeof providerMap]

  if (!provider) {
    return { error: "Unsupported sign-in provider.", status: 400 }
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
  const next = encodeURIComponent(resolveRedirectTarget(nextTarget))
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${next}`,
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
  )

  if ("error" in result) {
    const next = encodeURIComponent(resolveRedirectTarget(requestUrl.searchParams.get("next")))
    return NextResponse.redirect(new URL(`/login?next=${next}&authError=oauth`, requestUrl.origin), {
      headers: {
        "cache-control": "private, no-store",
      },
    })
  }

  return NextResponse.redirect(result.redirectTo, {
    headers: result.headers,
  })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    provider?: unknown
    next?: unknown
  } | null
  const providerKey = typeof body?.provider === "string" ? body.provider : ""
  const result = await createOAuthRedirect(request, providerKey, body?.next)

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(
    { redirectTo: result.redirectTo },
    {
      headers: result.headers,
    },
  )
}
