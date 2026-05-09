import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { applyTestWalletTopUp, isSameOriginMutation } from "@/lib/member-data"

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 })
  }

  const response = NextResponse.json(
    { walletEntry: null },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  const cookieStore = await cookies()
  const contentType = request.headers.get("content-type") ?? ""
  const acceptsHtml = request.headers.get("accept")?.includes("text/html") ?? false

  try {
    const body = contentType.includes("application/json")
      ? await request.json().catch(() => null)
      : contentType.includes("form")
        ? Object.fromEntries((await request.formData()).entries())
        : null
    const walletEntry = await applyTestWalletTopUp(cookieStore, response, body)

    if (!walletEntry) {
      if (acceptsHtml) {
        return NextResponse.redirect(new URL("/login?next=/member/settings", request.url), {
          status: 303,
          headers: response.headers,
        })
      }

      return NextResponse.json(
        { error: "Authentication is required." },
        {
          status: 401,
          headers: response.headers,
        },
      )
    }

    if (acceptsHtml) {
      return NextResponse.redirect(new URL("/member/settings?walletTopUp=success", request.url), {
        status: 303,
        headers: response.headers,
      })
    }

    return NextResponse.json(
      { walletEntry },
      {
        headers: response.headers,
      },
    )
  } catch (error) {
    if (acceptsHtml) {
      return NextResponse.redirect(new URL("/member/settings?walletTopUp=error", request.url), {
        status: 303,
        headers: response.headers,
      })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to top up test wallet." },
      {
        status: 400,
        headers: response.headers,
      },
    )
  }
}
