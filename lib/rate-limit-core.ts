import { createHmac } from "node:crypto"

export interface RateLimitPolicy {
  limit: number
  windowSeconds: number
  failClosed: boolean
}

export const RATE_LIMIT_POLICIES = {
  "auth.login": { limit: 12, windowSeconds: 300, failClosed: true },
  "auth.login.failure": { limit: 5, windowSeconds: 900, failClosed: true },
  "auth.register": { limit: 5, windowSeconds: 3600, failClosed: true },
  "auth.oauth": { limit: 20, windowSeconds: 300, failClosed: true },
  "member.game-rounds": { limit: 120, windowSeconds: 60, failClosed: true },
  "member.table-sessions": { limit: 20, windowSeconds: 300, failClosed: true },
  "member.cash-out": { limit: 10, windowSeconds: 300, failClosed: true },
  "member.purchases": { limit: 10, windowSeconds: 900, failClosed: true },
  "member.purchase-complete": { limit: 8, windowSeconds: 900, failClosed: true },
  "member.ad-reward-start": { limit: 12, windowSeconds: 900, failClosed: true },
  "member.ad-reward-complete": { limit: 8, windowSeconds: 900, failClosed: true },
  "member.test-topup": { limit: 5, windowSeconds: 3600, failClosed: true },
  "member.data-export": { limit: 5, windowSeconds: 3600, failClosed: true },
  "member.account-deletion": { limit: 8, windowSeconds: 3600, failClosed: true },
} as const satisfies Record<string, RateLimitPolicy>

export type RateLimitAction = keyof typeof RATE_LIMIT_POLICIES

export function normalizeIdentifier(value: unknown, maxLength = 180) {
  if (typeof value !== "string") return ""
  return value.trim().toLowerCase().replace(/\s+/g, " ").slice(0, maxLength)
}

export function resolveTrustedClientAddress(
  requestUrl: string,
  headers: Pick<Headers, "get">,
  environment: Record<string, string | undefined> = process.env,
) {
  if (environment.VERCEL === "1") {
    const vercelAddress = normalizeIdentifier(headers.get("x-vercel-forwarded-for") ?? headers.get("x-real-ip"))
    if (vercelAddress) return vercelAddress.split(",")[0]?.trim() || "vercel-unknown"
  }

  const hostname = new URL(requestUrl).hostname
  return ["localhost", "127.0.0.1", "::1"].includes(hostname) ? `local:${hostname}` : "untrusted-proxy"
}

export function createRateLimitKey(secret: string, action: string, identifiers: string[]) {
  const normalized = identifiers.map((value) => normalizeIdentifier(value)).filter(Boolean).join("|")
  return createHmac("sha256", secret).update(`${action}|${normalized || "anonymous"}`).digest("hex")
}

export interface RateLimitDimension {
  name: string
  value: unknown
}

export interface RateLimitDimensionKey {
  dimension: string
  keyHash: string
}

export function createRateLimitDimensionKeys(
  secret: string,
  action: string,
  dimensions: RateLimitDimension[],
): RateLimitDimensionKey[] {
  return dimensions.flatMap(({ name, value }) => {
    const normalizedName = normalizeIdentifier(name, 80)
    const normalizedValue = normalizeIdentifier(value)
    if (!normalizedName || !normalizedValue) return []

    return [{
      dimension: normalizedName,
      keyHash: createRateLimitKey(secret, action, [normalizedName, normalizedValue]),
    }]
  })
}
