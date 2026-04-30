export interface MemberSession {
  userId?: string
  account: string
  displayName: string
  loginAt: string
  provider?: "supabase" | "local"
}

export type OAuthProviderKey = "google" | "apple" | "microsoft" | "facebook" | "x"

export async function loginMember(account: string, password: string): Promise<MemberSession> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ account, password }),
  })

  const payload = (await response.json().catch(() => null)) as {
    session?: MemberSession
    error?: string
  } | null

  if (!response.ok || !payload?.session) {
    throw new Error(payload?.error ?? "Unable to sign in.")
  }

  return payload.session
}

export async function startOAuthSignIn(provider: OAuthProviderKey, next?: string) {
  if (typeof window === "undefined") {
    return
  }

  const response = await fetch("/api/auth/oauth", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ provider, next }),
  })

  const payload = (await response.json().catch(() => null)) as {
    redirectTo?: string
    error?: string
  } | null

  if (!response.ok || !payload?.redirectTo) {
    throw new Error(payload?.error ?? "Unable to start sign in.")
  }

  window.location.assign(payload.redirectTo)
}

export async function readMemberSession(): Promise<MemberSession | null> {
  if (typeof window === "undefined") {
    return null
  }

  const response = await fetch("/api/auth/session", {
    cache: "no-store",
  }).catch(() => null)

  if (!response?.ok) {
    return null
  }

  const payload = (await response.json().catch(() => null)) as {
    session?: MemberSession | null
  } | null

  return payload?.session ?? null
}

export async function clearMemberSession() {
  if (typeof window === "undefined") {
    return
  }

  await fetch("/api/auth/logout", {
    method: "POST",
  }).catch(() => null)
}
