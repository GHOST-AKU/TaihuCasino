import "server-only"

import type { NextResponse } from "next/server"

import {
  OBSERVABILITY_SCHEMA_VERSION,
  hashObservationIdentifier,
  normalizeObservationCode,
  observationErrorDetails,
  readObservationSessionToken,
  resolveObservationFailureLevel,
  resolveObservationRequestId,
  resolveObservationTraceId,
  sanitizeObservationText,
} from "@/lib/observability-core"

export type MemberFlow = "auth" | "table_session" | "game_round" | "cash_out"

interface ObserverOptions {
  flow: MemberFlow
  route: string
}

interface ObservationFields {
  authProvider?: unknown
  gameSlug?: unknown
  idempotent?: boolean
  outcome?: unknown
  reasonCode?: string
  status?: number
  tableSessionId?: unknown
  userIdentifier?: unknown
}

type ObservationLevel = "info" | "warn" | "error"

function getObservationSecret() {
  return process.env.TAIHU_OBSERVABILITY_SECRET
    ?? process.env.TAIHU_RATE_LIMIT_SECRET
    ?? process.env.TAIHU_SESSION_SECRET
    ?? (process.env.NODE_ENV !== "production" ? "taihu-local-observability-secret" : undefined)
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== ""))
}

export function createRequestObserver(request: Request, options: ObserverOptions) {
  const startedAt = Date.now()
  const secret = getObservationSecret()
  const requestId = resolveObservationRequestId(request.headers.get("x-request-id"))
  const traceId = resolveObservationTraceId(request.headers.get("traceparent"))
  const vercelRequestId = sanitizeObservationText(request.headers.get("x-vercel-id"), 120)
  const sessionToken = readObservationSessionToken(request.headers.get("cookie"))
  const sessionHash = hashObservationIdentifier(secret, sessionToken, "session")

  function emit(level: ObservationLevel, event: string, fields: ObservationFields = {}, error?: unknown) {
    const payload = compactRecord({
      schemaVersion: OBSERVABILITY_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      level,
      event: normalizeObservationCode(event, "member_flow.unknown"),
      flow: options.flow,
      route: options.route,
      method: request.method,
      requestId,
      traceId,
      vercelRequestId,
      sessionHash,
      userHash: hashObservationIdentifier(secret, fields.userIdentifier, "user"),
      tableSessionHash: hashObservationIdentifier(secret, fields.tableSessionId, "table-session"),
      authProvider: sanitizeObservationText(fields.authProvider, 40),
      gameSlug: sanitizeObservationText(fields.gameSlug, 80),
      outcome: sanitizeObservationText(fields.outcome, 40),
      idempotent: fields.idempotent,
      reasonCode: fields.reasonCode ? normalizeObservationCode(fields.reasonCode) : undefined,
      status: fields.status,
      durationMs: Date.now() - startedAt,
      ...(error === undefined ? {} : observationErrorDetails(error)),
    })
    const line = JSON.stringify(payload)

    if (level === "error") console.error(line)
    else if (level === "warn") console.warn(line)
    else console.info(line)
  }

  return {
    requestId,
    info(event: string, fields?: ObservationFields) {
      emit("info", event, fields)
    },
    success(event: string, fields?: ObservationFields) {
      emit("info", event, fields)
    },
    reject(event: string, fields?: ObservationFields) {
      emit("warn", event, fields)
    },
    failure(event: string, error: unknown, fields: ObservationFields = {}) {
      emit(resolveObservationFailureLevel(event, fields.status), event, fields, error)
    },
    attach<T extends NextResponse>(response: T) {
      response.headers.set("x-request-id", requestId)
      response.headers.set("server-timing", `app;dur=${Math.max(0, Date.now() - startedAt)}`)
      return response
    },
  }
}
