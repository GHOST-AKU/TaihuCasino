import { createHmac, randomUUID } from "node:crypto"

export const OBSERVABILITY_SCHEMA_VERSION = "taihu-observability-v1"

export function resolveObservationFailureLevel(event: string, status = 500) {
  return event.endsWith(".failed") || status >= 500 ? "error" : "warn"
}

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,120}$/
const TRACEPARENT_PATTERN = /^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/i

export function resolveObservationRequestId(value: string | null | undefined) {
  const candidate = value?.trim() ?? ""
  return REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID()
}

export function resolveObservationTraceId(value: string | null | undefined) {
  const match = value?.trim().match(TRACEPARENT_PATTERN)
  return match?.[1]?.toLowerCase()
}

export function hashObservationIdentifier(secret: string | undefined, value: unknown, namespace: string) {
  if (!secret || typeof value !== "string" || !value.trim()) return undefined
  return createHmac("sha256", secret)
    .update(`${namespace}|${value.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 24)
}

export function readObservationSessionToken(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return undefined
  return cookieHeader.match(/(?:^|;\s*)(?:taihu-member-session|sb-[^=]+-auth-token)=([^;]+)/)?.[1]
}

export function sanitizeObservationText(value: unknown, maxLength = 240) {
  if (typeof value !== "string") return undefined

  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[redacted-id]")
    .replace(/\b[a-f0-9]{32,}\b/gi, "[redacted-token]")
    .replace(/\b(?:bearer\s+)?[a-z0-9_-]{24,}(?:\.[a-z0-9_-]{12,}){1,2}\b/gi, "[redacted-token]")
    .replace(/\b(?:password|cookie|authorization|token|secret)\s*[=:]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, maxLength) || undefined
}

export function normalizeObservationCode(value: unknown, fallback = "unknown") {
  if (typeof value !== "string") return fallback
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_").slice(0, 80)
  return normalized || fallback
}

export function observationErrorDetails(error: unknown) {
  return {
    errorType: error instanceof Error ? normalizeObservationCode(error.name, "error") : "unknown_error",
    errorMessage: sanitizeObservationText(error instanceof Error ? error.message : String(error)),
  }
}
