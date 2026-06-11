import assert from "node:assert/strict"
import test from "node:test"

import {
  STUB_CREDITING_DISABLED_MESSAGE,
  createStubCreditIdempotencyKey,
  isStubCreditingEnabled,
  requireStubCreditingEnabled,
} from "../lib/stub-crediting.ts"

test("production disables stub crediting by default", () => {
  assert.equal(isStubCreditingEnabled({ NODE_ENV: "production" }), false)
  assert.equal(
    isStubCreditingEnabled({ NODE_ENV: "production", TAIHU_ENABLE_STUB_CREDITING: "false" }),
    false,
  )
})

test("production requires an exact explicit enable flag", () => {
  assert.equal(
    isStubCreditingEnabled({ NODE_ENV: "production", TAIHU_ENABLE_STUB_CREDITING: "TRUE" }),
    false,
  )
  assert.equal(
    isStubCreditingEnabled({ NODE_ENV: "production", TAIHU_ENABLE_STUB_CREDITING: "true" }),
    true,
  )
})

test("development keeps stub crediting available", () => {
  assert.equal(isStubCreditingEnabled({ NODE_ENV: "development" }), true)
})

test("the guard rejects production bypass attempts", () => {
  assert.throws(
    () => requireStubCreditingEnabled({ NODE_ENV: "production" }),
    new Error(STUB_CREDITING_DISABLED_MESSAGE),
  )
})

test("the guard permits controlled test environments", () => {
  assert.doesNotThrow(() => requireStubCreditingEnabled({ NODE_ENV: "test" }))
  assert.doesNotThrow(() =>
    requireStubCreditingEnabled({ NODE_ENV: "production", TAIHU_ENABLE_STUB_CREDITING: "true" }),
  )
})

test("replayed stub completions reuse the same ledger idempotency key", () => {
  assert.equal(createStubCreditIdempotencyKey("ad-reward", "reward-42"), "ad-reward:reward-42")
  assert.equal(createStubCreditIdempotencyKey("ad-reward", "reward-42"), "ad-reward:reward-42")
  assert.equal(createStubCreditIdempotencyKey("purchase", "purchase-42"), "purchase:purchase-42")
  assert.equal(createStubCreditIdempotencyKey("purchase", "purchase-42"), "purchase:purchase-42")
})
