export interface MemberSession {
  userId?: string
  account: string
  displayName: string
  loginAt: string
  provider?: "supabase" | "local"
}

export type OAuthProviderKey = "google" | "apple" | "microsoft" | "facebook" | "x"

export interface RegisterMemberResult {
  confirmationRequired: boolean
  session: MemberSession | null
}

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

export async function registerMember({
  email,
  password,
  displayName,
  next,
  captchaToken,
}: {
  email: string
  password: string
  displayName: string
  next?: string
  captchaToken?: string
}): Promise<RegisterMemberResult> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password, displayName, next, captchaToken }),
  })

  const payload = (await response.json().catch(() => null)) as {
    confirmationRequired?: boolean
    session?: MemberSession | null
    error?: string
  } | null

  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? "Unable to create account.")
  }

  return {
    confirmationRequired: Boolean(payload.confirmationRequired),
    session: payload.session ?? null,
  }
}

export async function startOAuthSignIn(provider: OAuthProviderKey, next?: string) {
  if (typeof window === "undefined") {
    return
  }

  const params = new URLSearchParams({ provider })
  if (next) {
    params.set("next", next)
  }

  window.location.href = `/api/auth/oauth?${params.toString()}`
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
