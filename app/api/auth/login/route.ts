import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { createRequestObserver } from "@/lib/observability"
import { enforceRateLimit } from "@/lib/rate-limit"
import {
  MEMBER_SESSION_COOKIE,
  assertSupabaseAuthConfigured,
  createSessionFromSupabaseUser,
  createSessionToken,
  createSupabaseAuthClient,
  getSessionCookieOptions,
  isSupabaseAuthConfigured,
  validateCredentials,
} from "@/lib/server-auth"

export async function POST(request: Request) {
  const observer = createRequestObserver(request, { flow: "auth", route: "/api/auth/login" })
  const body = (await request.json().catch(() => null)) as {
    account?: unknown
    password?: unknown
    captchaToken?: unknown
  } | null

  const account = typeof body?.account === "string" ? body.account.trim() : ""
  const password = typeof body?.password === "string" ? body.password : ""
  const captchaToken = typeof body?.captchaToken === "string" ? body.captchaToken.trim() : ""
  observer.info("auth.login.started", { userIdentifier: account })

  if (!account || !password) {
    observer.reject("auth.login.rejected", { status: 400, reasonCode: "missing_credentials", userIdentifier: account })
    return observer.attach(NextResponse.json({ error: "Account and password are required." }, { status: 400 }))
  }

  const limited = await enforceRateLimit(request, "auth.login", {
    identifiers: [account],
    requestId: observer.requestId,
  })
  if (limited) {
    observer.reject("auth.login.blocked", {
      status: limited.status,
      reasonCode: limited.status === 429 ? "rate_limit_exceeded" : "rate_limit_unavailable",
      userIdentifier: account,
    })
    return observer.attach(limited)
  }

  if (isSupabaseAuthConfigured()) {
    if (!captchaToken) {
      observer.reject("auth.login.rejected", { status: 400, reasonCode: "missing_captcha", userIdentifier: account })
      return observer.attach(NextResponse.json({ error: "Please complete the security check." }, { status: 400 }))
    }

    try {
      assertSupabaseAuthConfigured()

      const response = NextResponse.json(
        { session: null },
        {
          headers: {
            "cache-control": "private, no-store",
          },
        },
      )
      const cookieStore = await cookies()
      const supabase = createSupabaseAuthClient(cookieStore, response)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: account,
        password,
        options: { captchaToken },
      })

      if (error || !data.user) {
        const failureLimited = await enforceRateLimit(request, "auth.login.failure", {
          auditAllowed: true,
          identifiers: [account],
          requestId: observer.requestId,
          reason: "invalid_credentials",
        })
        if (failureLimited) {
          observer.reject("auth.login.blocked", {
            authProvider: "supabase",
            status: failureLimited.status,
            reasonCode: "invalid_credentials_rate_limited",
            userIdentifier: account,
          })
          return observer.attach(failureLimited)
        }
        observer.reject("auth.login.rejected", {
          authProvider: "supabase",
          status: 401,
          reasonCode: "invalid_credentials",
          userIdentifier: account,
        })
        return observer.attach(NextResponse.json({ error: "Invalid account or password." }, { status: 401 }))
      }

      const session = createSessionFromSupabaseUser(data.user)
      observer.success("auth.login.succeeded", {
        authProvider: "supabase",
        status: 200,
        userIdentifier: data.user.id,
      })

      return observer.attach(NextResponse.json({ session }, { headers: response.headers }))
    } catch (error) {
      observer.failure("auth.login.failed", error, {
        authProvider: "supabase",
        status: 500,
        reasonCode: "auth_provider_error",
        userIdentifier: account,
      })
      return observer.attach(
        NextResponse.json({ error: "Supabase authentication is not configured correctly." }, { status: 500 }),
      )
    }
  }

  let session
  let token

  try {
    session = validateCredentials(account, password)
    token = session ? createSessionToken(session) : null
  } catch (error) {
    observer.failure("auth.login.failed", error, {
      authProvider: "local",
      status: 500,
      reasonCode: "auth_configuration_error",
      userIdentifier: account,
    })
    return observer.attach(
      NextResponse.json({ error: "Authentication is not configured correctly." }, { status: 500 }),
    )
  }

  if (!session || !token) {
    const failureLimited = await enforceRateLimit(request, "auth.login.failure", {
      auditAllowed: true,
      identifiers: [account],
      requestId: observer.requestId,
      reason: "invalid_credentials",
    })
    if (failureLimited) {
      observer.reject("auth.login.blocked", {
        authProvider: "local",
        status: failureLimited.status,
        reasonCode: "invalid_credentials_rate_limited",
        userIdentifier: account,
      })
      return observer.attach(failureLimited)
    }
    observer.reject("auth.login.rejected", {
      authProvider: "local",
      status: 401,
      reasonCode: "invalid_credentials",
      userIdentifier: account,
    })
    return observer.attach(NextResponse.json({ error: "Invalid account or password." }, { status: 401 }))
  }

  const response = NextResponse.json(
    { session },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
  response.cookies.set(MEMBER_SESSION_COOKIE, token, getSessionCookieOptions())
  observer.success("auth.login.succeeded", {
    authProvider: "local",
    status: 200,
    userIdentifier: session.userId ?? session.account,
  })

  return observer.attach(response)
}
