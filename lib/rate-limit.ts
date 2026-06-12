import "server-only"

import { randomUUID } from "node:crypto"

import { NextResponse } from "next/server"

import { createSupabaseServiceClient, getSessionSecret } from "@/lib/server-auth"
import {
  RATE_LIMIT_POLICIES,
  createRateLimitKey,
  normalizeIdentifier,
  resolveTrustedClientAddress,
  type RateLimitAction,
} from "@/lib/rate-limit-core"

interface ConsumeResult {
  allowed?: boolean
  count?: number
  limit?: number
  retry_after?: number
}

interface EnforceRateLimitOptions {
  auditAllowed?: boolean
  identifiers?: unknown[]
  userId?: string
  metadata?: Record<string, string | number | boolean>
  reason?: string
  policy?: {
    limit: number
    windowSeconds: number
    failClosed: boolean
  }
}

function getRateLimitSecret() {
  const secret = process.env.TAIHU_RATE_LIMIT_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV !== "production") return getSessionSecret()
  throw new Error("TAIHU_RATE_LIMIT_SECRET is required in production.")
}

function getSessionFingerprint(request: Request) {
  const cookie = request.headers.get("cookie") ?? ""
  return cookie.match(/(?:^|;\s*)(?:taihu-member-session|sb-[^=]+-auth-token)=([^;]+)/)?.[1] ?? ""
}

function responseHeaders(requestId: string, retryAfter?: number) {
  const headers: Record<string, string> = {
    "cache-control": "private, no-store",
    "x-request-id": requestId,
  }
  if (retryAfter) headers["retry-after"] = String(retryAfter)
  return headers
}

async function recordEvent(
  action: RateLimitAction,
  result: string,
  keyHash: string,
  requestId: string,
  options: EnforceRateLimitOptions,
) {
  try {
    const supabase = createSupabaseServiceClient()
    await supabase.rpc("record_security_event", {
      p_action: action,
      p_result: result,
      p_key_hash: keyHash,
      p_request_id: requestId,
      p_reason: options.reason ?? null,
      p_user_id: options.userId ?? null,
      p_metadata: options.metadata ?? {},
    })
  } catch {
    // The original request result remains authoritative when audit logging is unavailable.
  }
}

export async function enforceRateLimit(
  request: Request,
  action: RateLimitAction,
  options: EnforceRateLimitOptions = {},
) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 120) || randomUUID()
  const policy = options.policy ?? RATE_LIMIT_POLICIES[action]
  const clientAddress = resolveTrustedClientAddress(request.url, request.headers)
  const identifiers = [
    clientAddress,
    getSessionFingerprint(request),
    ...(options.identifiers ?? []).map((value) => normalizeIdentifier(value)),
  ]
  let keyHash = ""

  try {
    keyHash = createRateLimitKey(getRateLimitSecret(), action, identifiers)
    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase.rpc("consume_api_rate_limit", {
      p_action: action,
      p_key_hash: keyHash,
      p_limit: policy.limit,
      p_window_seconds: policy.windowSeconds,
    })

    if (error) throw error

    const result = (data ?? {}) as ConsumeResult
    if (result.allowed === false) {
      await recordEvent(action, "blocked", keyHash, requestId, {
        ...options,
        reason: options.reason ?? "rate_limit_exceeded",
        metadata: { ...options.metadata, count: result.count ?? 0, limit: result.limit ?? policy.limit },
      })
      return NextResponse.json(
        { error: "Too many requests.", requestId },
        { status: 429, headers: responseHeaders(requestId, Math.max(1, result.retry_after ?? policy.windowSeconds)) },
      )
    }

    if (options.auditAllowed) {
      await recordEvent(action, "observed", keyHash, requestId, options)
    }

    return null
  } catch {
    if (process.env.NODE_ENV !== "production") return null

    if (keyHash) {
      await recordEvent(action, "storage_error", keyHash, requestId, {
        ...options,
        reason: "rate_limit_storage_unavailable",
      })
    }

    if (!policy.failClosed) return null

    return NextResponse.json(
      { error: "Security service is temporarily unavailable.", requestId },
      { status: 503, headers: responseHeaders(requestId, 30) },
    )
  }
}

export async function recordSecuritySignal(
  request: Request,
  action: RateLimitAction,
  reason: string,
  identifiers: unknown[] = [],
) {
  try {
    const requestId = request.headers.get("x-request-id")?.slice(0, 120) || randomUUID()
    const clientAddress = resolveTrustedClientAddress(request.url, request.headers)
    const keyHash = createRateLimitKey(getRateLimitSecret(), action, [
      clientAddress,
      getSessionFingerprint(request),
      ...identifiers.map((value) => normalizeIdentifier(value)),
    ])
    await recordEvent(action, "observed", keyHash, requestId, { reason })
  } catch {
    // Security telemetry must not change the already-authoritative business result.
  }
}
