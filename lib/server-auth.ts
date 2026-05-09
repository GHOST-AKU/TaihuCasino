import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import type { cookies } from "next/headers"
import type { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"

import type { MemberSession } from "@/lib/member-session"

export const MEMBER_SESSION_COOKIE = "taihu-member-session"

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

interface AuthUser {
  account: string
  password: string
  displayName?: string
}

interface SessionPayload extends MemberSession {
  exp: number
}

type CookieStore = Awaited<ReturnType<typeof cookies>>

const LOCAL_DEMO_AUTH_USER = {
  account: "demo@taihu.casino",
  password: "taihu-demo-2026",
  displayName: "Demo Member",
} satisfies AuthUser

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL
}

function getSupabaseKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY
}

function getDisplayName(account: string, displayName?: string) {
  if (displayName) {
    return displayName
  }

  if (account.includes("@")) {
    return account.split("@")[0]
  }

  return account.length > 10 ? `${account.slice(0, 3)} ${account.slice(-4)}` : account
}

function getAuthUsers() {
  const usersJson = process.env.TAIHU_AUTH_USERS

  if (usersJson) {
    try {
      const users = JSON.parse(usersJson) as AuthUser[]
      return users.filter((user) => user.account && user.password)
    } catch {
      throw new Error("TAIHU_AUTH_USERS must be a JSON array of account/password records.")
    }
  }

  const account = process.env.TAIHU_AUTH_ACCOUNT
  const password = process.env.TAIHU_AUTH_PASSWORD

  if (account && password) {
    return [{ account, password }]
  }

  if (process.env.NODE_ENV !== "production") {
    return [LOCAL_DEMO_AUTH_USER]
  }

  return []
}

export function getLocalDemoCredentials() {
  if (process.env.NODE_ENV === "production") {
    return null
  }

  return LOCAL_DEMO_AUTH_USER
}

export function getSessionSecret() {
  const secret = process.env.TAIHU_SESSION_SECRET

  if (secret) {
    return secret
  }

  if (process.env.NODE_ENV !== "production") {
    return "taihu-local-development-session-secret"
  }

  throw new Error("TAIHU_SESSION_SECRET is required in production.")
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url")
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url")
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function isSupabaseAuthConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseKey())
}

export function assertSupabaseAuthConfigured() {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase Auth is not configured.")
  }
}

export function createSupabaseAuthClient(cookieStore: CookieStore, response?: NextResponse) {
  const supabaseUrl = getSupabaseUrl()
  const supabaseKey = getSupabaseKey()

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.")
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // Server Components can read cookies but cannot always write refreshed auth cookies.
          }
          response?.cookies.set(name, value, options)
        })

        if (response) {
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value)
          })
        }
      },
    },
  })
}

export function createSupabaseServiceClient() {
  const supabaseUrl = getSupabaseUrl()
  const serviceRoleKey = getSupabaseServiceRoleKey()

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for server-side wallet mutations.")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export function createSessionFromSupabaseUser(user: User): MemberSession {
  const metadataName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : undefined

  return {
    userId: user.id,
    account: user.email ?? user.phone ?? user.id,
    displayName: getDisplayName(user.email ?? user.phone ?? user.id, metadataName),
    loginAt: user.last_sign_in_at ?? new Date().toISOString(),
    provider: "supabase",
  }
}

export function validateCredentials(account: string, password: string) {
  const users = getAuthUsers()

  if (users.length === 0) {
    return null
  }

  const user = users.find((item) => item.account.toLowerCase() === account.toLowerCase())

  if (!user || !constantTimeEqual(user.password, password)) {
    return null
  }

  return createSession(user.account, user.displayName)
}

export function createSession(account: string, displayName?: string): MemberSession {
  return {
    account,
    displayName: getDisplayName(account, displayName),
    loginAt: new Date().toISOString(),
    provider: "local",
  }
}

export function createSessionToken(session: MemberSession) {
  const payload: SessionPayload = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))

  return `${encodedPayload}.${sign(encodedPayload)}`
}

export function readSessionToken(token: string | undefined): MemberSession | null {
  if (!token) {
    return null
  }

  const [encodedPayload, signature] = token.split(".")

  if (!encodedPayload || !signature || !constantTimeEqual(signature, sign(encodedPayload))) {
    return null
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload

    if (!payload.account || !payload.displayName || !payload.loginAt || payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return {
      userId: payload.userId,
      account: payload.account,
      displayName: payload.displayName,
      loginAt: payload.loginAt,
      provider: payload.provider,
    }
  } catch {
    return null
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  }
}
