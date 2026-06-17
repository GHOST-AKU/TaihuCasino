import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  hashObservationIdentifier,
  readObservationSessionToken,
  resolveObservationFailureLevel,
  resolveObservationRequestId,
  resolveObservationTraceId,
  sanitizeObservationText,
} from "../lib/observability-core.ts"

test("failed events remain visible in error-level runtime log queries", () => {
  assert.equal(resolveObservationFailureLevel("table_session.open.failed", 400), "error")
  assert.equal(resolveObservationFailureLevel("game_round.settle.failed", 400), "error")
  assert.equal(resolveObservationFailureLevel("cash_out.failed", 400), "error")
  assert.equal(resolveObservationFailureLevel("member_flow.unknown", 500), "error")
  assert.equal(resolveObservationFailureLevel("member_flow.rejected", 400), "warn")
})

test("request and trace identifiers accept only bounded structured values", () => {
  assert.equal(resolveObservationRequestId("req_12345678"), "req_12345678")
  assert.match(resolveObservationRequestId("bad id with spaces"), /^[0-9a-f-]{36}$/)
  assert.equal(
    resolveObservationTraceId("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"),
    "4bf92f3577b34da6a3ce929d0e0e4736",
  )
  assert.equal(resolveObservationTraceId("invalid"), undefined)
})

test("user, session, and table identifiers are pseudonymous and namespaced", () => {
  const secret = "test-observability-secret"
  const userHash = hashObservationIdentifier(secret, "player@example.com", "user")
  const sessionHash = hashObservationIdentifier(secret, "player@example.com", "session")

  assert.match(userHash, /^[a-f0-9]{24}$/)
  assert.notEqual(userHash, sessionHash)
  assert.equal(userHash.includes("player"), false)
  assert.equal(hashObservationIdentifier(undefined, "player@example.com", "user"), undefined)
})

test("session extraction never requires logging the raw cookie header", () => {
  assert.equal(
    readObservationSessionToken("theme=dark; taihu-member-session=signed-session-value; other=1"),
    "signed-session-value",
  )
  assert.equal(readObservationSessionToken("theme=dark"), undefined)
})

test("error text redacts common credentials and personal identifiers", () => {
  const sanitized = sanitizeObservationText(
    "email player@example.com id 123e4567-e89b-12d3-a456-426614174000 password=secret123 token=abcdefghijklmnopqrstuvwx.yyyyyyyyyyyyyyyy.zzzzzzzzzzzz",
  )

  assert.equal(sanitized.includes("player@example.com"), false)
  assert.equal(sanitized.includes("secret123"), false)
  assert.equal(sanitized.includes("123e4567"), false)
  assert.equal(sanitized.includes("abcdefghijklmnopqrstuvwx"), false)
  assert.match(sanitized, /redacted/)
})

test("critical member routes use the shared observer and propagate request ids", async () => {
  const routePaths = [
    "../app/api/auth/login/route.ts",
    "../app/api/member/table-sessions/route.ts",
    "../app/api/member/game-rounds/route.ts",
    "../app/api/member/table-sessions/[id]/cash-out/route.ts",
  ]

  for (const path of routePaths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8")
    assert.match(source, /createRequestObserver/)
    assert.match(source, /observer\.attach/)
    assert.match(source, /requestId: observer\.requestId/)
  }
})
