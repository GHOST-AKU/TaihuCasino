export const MEMBER_SESSION_STORAGE_KEY = "taihu-member-session"
export const MEMBER_SESSION_COOKIE = "taihu-member-session"

export interface MemberSession {
  account: string
  displayName: string
  loginAt: string
}

export function createMemberSession(account: string): MemberSession {
  const displayName = account.includes("@")
    ? account.split("@")[0]
    : account.length > 10
      ? `${account.slice(0, 3)} ${account.slice(-4)}`
      : account

  return {
    account,
    displayName,
    loginAt: new Date().toISOString(),
  }
}

export function persistMemberSession(session: MemberSession, rememberDevice: boolean) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(MEMBER_SESSION_STORAGE_KEY, JSON.stringify(session))

  const expires = rememberDevice
    ? `; max-age=${60 * 60 * 24 * 7}`
    : ""

  document.cookie = `${MEMBER_SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(session))}; path=/${expires}; samesite=lax`
}

export function readMemberSession(): MemberSession | null {
  if (typeof window === "undefined") {
    return null
  }

  const fromStorage = window.localStorage.getItem(MEMBER_SESSION_STORAGE_KEY)
  if (fromStorage) {
    try {
      return JSON.parse(fromStorage) as MemberSession
    } catch {
      window.localStorage.removeItem(MEMBER_SESSION_STORAGE_KEY)
    }
  }

  const cookieMatch = document.cookie.match(
    new RegExp(`(?:^|; )${MEMBER_SESSION_COOKIE.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&")}=([^;]*)`),
  )

  if (!cookieMatch) {
    return null
  }

  try {
    return JSON.parse(decodeURIComponent(cookieMatch[1])) as MemberSession
  } catch {
    return null
  }
}

export function clearMemberSession() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(MEMBER_SESSION_STORAGE_KEY)
  document.cookie = `${MEMBER_SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`
}
