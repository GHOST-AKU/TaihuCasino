import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { isValidRateLimitDeviceId, RATE_LIMIT_DEVICE_COOKIE } from "@/lib/rate-limit-core"

const MEMBER_SESSION_COOKIE = "taihu-member-session"
const DEVICE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function attachDeviceCookie(request: NextRequest, response: NextResponse) {
  const currentDeviceId = request.cookies.get(RATE_LIMIT_DEVICE_COOKIE)?.value
  if (!isValidRateLimitDeviceId(currentDeviceId)) {
    response.cookies.set(RATE_LIMIT_DEVICE_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
    })
  }

  return response
}

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL
}

function getSupabaseKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

function isPublicPath(pathname: string) {
  const publicPages = new Set(["/terms", "/privacy", "/responsible-gaming", "/support"])
  return (
    publicPages.has(pathname) ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/")
  )
}

function redirectToLogin(request: NextRequest) {
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`
  const loginUrl = new URL("/login", request.url)

  loginUrl.searchParams.set("next", next)

  return attachDeviceCookie(request, NextResponse.redirect(loginUrl))
}

export async function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return attachDeviceCookie(request, NextResponse.next({ request }))
  }

  const supabaseUrl = getSupabaseUrl()
  const supabaseKey = getSupabaseKey()

  if (!supabaseUrl || !supabaseKey) {
    if (!request.cookies.has(MEMBER_SESSION_COOKIE)) {
      return redirectToLogin(request)
    }

    return attachDeviceCookie(request, NextResponse.next({ request }))
  }

  const response = NextResponse.next({
    request,
    headers: {
      "cache-control": "private, no-store",
    },
  })
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value)
        })
      },
    },
  })

  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    return redirectToLogin(request)
  }

  return attachDeviceCookie(request, response)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
}
