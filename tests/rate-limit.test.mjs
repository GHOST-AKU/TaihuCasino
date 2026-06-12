import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  RATE_LIMIT_POLICIES,
  createRateLimitDimensionKeys,
  createRateLimitKey,
  resolveTrustedClientAddress,
} from "../lib/rate-limit-core.ts"

test("untrusted forwarded headers cannot select a different client identity", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.10",
    "x-real-ip": "203.0.113.11",
  })

  assert.equal(
    resolveTrustedClientAddress("https://casino.example/api/auth/login", headers, {}),
    "untrusted-proxy",
  )
})

test("Vercel deployment trusts only the Vercel-provided client address", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.99",
    "x-vercel-forwarded-for": "198.51.100.20, 10.0.0.1",
  })

  assert.equal(
    resolveTrustedClientAddress("https://casino.example/api/auth/login", headers, { VERCEL: "1" }),
    "198.51.100.20",
  )
})

test("rate-limit keys isolate actions and account identifiers without storing raw values", () => {
  const secret = "test-rate-limit-secret"
  const loginA = createRateLimitKey(secret, "auth.login", ["198.51.100.20", "player-a@example.com"])
  const loginB = createRateLimitKey(secret, "auth.login", ["198.51.100.20", "player-b@example.com"])
  const registerA = createRateLimitKey(secret, "auth.register", ["198.51.100.20", "player-a@example.com"])

  assert.notEqual(loginA, loginB)
  assert.notEqual(loginA, registerA)
  assert.equal(loginA.includes("player-a@example.com"), false)
  assert.match(loginA, /^[a-f0-9]{64}$/)
})

test("rate-limit dimensions preserve client and account buckets independently", () => {
  const secret = "test-rate-limit-secret"
  const dimensions = (client, account) => createRateLimitDimensionKeys(secret, "auth.login", [
    { name: "client", value: client },
    { name: "session", value: "" },
    { name: "identifier:0", value: account },
  ])

  const first = dimensions("198.51.100.20", "player-a@example.com")
  const rotatedAccount = dimensions("198.51.100.20", "player-b@example.com")
  const rotatedClient = dimensions("198.51.100.21", "player-a@example.com")

  assert.deepEqual(first.map(({ dimension }) => dimension), ["client", "identifier:0"])
  assert.equal(first[0].keyHash, rotatedAccount[0].keyHash, "rotating accounts must retain the client bucket")
  assert.equal(first[1].keyHash, rotatedClient[1].keyHash, "rotating clients must retain the account bucket")
  assert.notEqual(first[1].keyHash, rotatedAccount[1].keyHash)
  assert.notEqual(first[0].keyHash, rotatedClient[0].keyHash)
})

test("sensitive mutation policies fail closed and have finite windows", () => {
  for (const [action, policy] of Object.entries(RATE_LIMIT_POLICIES)) {
    assert.equal(policy.failClosed, true, `${action} must fail closed`)
    assert.ok(policy.limit > 0, `${action} must have a positive limit`)
    assert.ok(policy.windowSeconds > 0, `${action} must have a finite window`)
  }
})

test("database migration provides atomic counters, expiry cleanup, audit events, and service-role boundaries", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260612090000_api_abuse_protection.sql", import.meta.url),
    "utf8",
  )

  assert.match(migration, /on conflict \(action, key_hash, window_started_at\) do update/)
  assert.match(migration, /request_count = public\.api_rate_limit_buckets\.request_count \+ 1/)
  assert.match(migration, /v_now timestamptz := now\(\)/)
  assert.match(migration, /bucket\.request_count <= p_limit/)
  assert.match(migration, /retry_after/)
  assert.match(migration, /cleanup_api_abuse_protection/)
  assert.match(migration, /alter table public\.api_rate_limit_buckets enable row level security/)
  assert.match(migration, /revoke execute on function public\.consume_api_rate_limit/)
  assert.match(migration, /grant execute on function public\.consume_api_rate_limit.*to service_role/s)
  assert.equal(/references auth\.users/.test(migration), false)
})

test("all required first-wave routes call the shared limiter", async () => {
  const routePaths = [
    "../app/api/auth/login/route.ts",
    "../app/api/auth/register/route.ts",
    "../app/api/auth/oauth/route.ts",
    "../app/api/member/game-rounds/route.ts",
    "../app/api/member/table-sessions/route.ts",
    "../app/api/member/table-sessions/[id]/cash-out/route.ts",
    "../app/api/member/purchases/route.ts",
    "../app/api/member/purchases/[id]/complete/route.ts",
    "../app/api/member/ad-rewards/start/route.ts",
    "../app/api/member/ad-rewards/complete/route.ts",
    "../app/api/member/wallet/test-topup/route.ts",
  ]

  for (const routePath of routePaths) {
    const source = await readFile(new URL(routePath, import.meta.url), "utf8")
    assert.match(source, /enforceRateLimit/, `${routePath} must call the shared limiter`)
  }
})

test("production storage failures return a fail-closed response", async () => {
  const source = await readFile(new URL("../lib/rate-limit.ts", import.meta.url), "utf8")

  assert.match(source, /process\.env\.NODE_ENV !== "production"/)
  assert.match(source, /if \(!policy\.failClosed\) return null/)
  assert.match(source, /status: 503/)
  assert.match(source, /status: 429/)
  assert.match(source, /"retry-after"/)
  assert.match(source, /recordSecuritySignal/)
})
