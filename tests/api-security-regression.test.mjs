import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8")
}

const protectedMutations = [
  "../app/api/auth/login/route.ts",
  "../app/api/auth/register/route.ts",
  "../app/api/auth/oauth/route.ts",
  "../app/api/member/account-deletion/route.ts",
  "../app/api/member/ad-rewards/complete/route.ts",
  "../app/api/member/ad-rewards/start/route.ts",
  "../app/api/member/game-rounds/route.ts",
  "../app/api/member/purchases/route.ts",
  "../app/api/member/purchases/[id]/complete/route.ts",
  "../app/api/member/table-sessions/route.ts",
  "../app/api/member/table-sessions/[id]/cash-out/route.ts",
  "../app/api/member/wallet/test-topup/route.ts",
]

test("sensitive API mutations keep shared rate-limit coverage", async () => {
  for (const path of protectedMutations) {
    const code = await source(path)
    assert.match(code, /enforceRateLimit/, `${path} must enforce shared rate limits`)
  }
})

test("member write APIs reject cross-origin mutations before state changes", async () => {
  const memberWriteRoutes = protectedMutations.filter((path) => path.includes("../app/api/member/"))

  for (const path of memberWriteRoutes) {
    const code = await source(path)
    assert.match(code, /isSameOriginMutation\(request\)/, `${path} must reject cross-origin writes`)
    assert.match(code, /Cross-origin mutation rejected/, `${path} must return a clear cross-origin rejection`)
  }
})

test("production-only stub credit paths cannot be bypassed into wallet crediting", async () => {
  const [memberData, stubGuard, purchaseComplete, adComplete, topup] = await Promise.all([
    source("../lib/member-data.ts"),
    source("../lib/stub-crediting.ts"),
    source("../app/api/member/purchases/[id]/complete/route.ts"),
    source("../app/api/member/ad-rewards/complete/route.ts"),
    source("../app/api/member/wallet/test-topup/route.ts"),
  ])

  assert.match(stubGuard, /NODE_ENV !== "production"/)
  assert.match(stubGuard, /TAIHU_ENABLE_STUB_CREDITING === "true"/)
  assert.match(memberData, /export async function startAdReward[\s\S]*?requireStubCreditingEnabled\(\)/)
  assert.match(memberData, /export async function completeAdReward[\s\S]*?requireStubCreditingEnabled\(\)/)
  assert.match(memberData, /export async function createPurchase[\s\S]*?requireStubCreditingEnabled\(\)/)
  assert.match(memberData, /export async function completePurchase[\s\S]*?requireStubCreditingEnabled\(\)/)
  assert.match(memberData, /TAIHU_ENABLE_TEST_WALLET_TOPUP !== "true"/)
  assert.match(purchaseComplete, /isSameOriginMutation/)
  assert.match(adComplete, /isSameOriginMutation/)
  assert.match(topup, /isSameOriginMutation/)
})

test("authoritative settlement APIs do not accept client-written results or cash-out balances", async () => {
  const [roundRoute, roundClient, cashOutRoute, tableClient, memberData] = await Promise.all([
    source("../app/api/member/game-rounds/route.ts"),
    source("../lib/member-round-client.ts"),
    source("../app/api/member/table-sessions/[id]/cash-out/route.ts"),
    source("../lib/table-session-client.ts"),
    source("../lib/member-data.ts"),
  ])

  assert.match(roundRoute, /recordGameProgress/)
  assert.match(cashOutRoute, /cashOutTableSession/)
  const clientInputContract = roundClient.slice(
    roundClient.indexOf("export interface ClientGameRoundInput"),
    roundClient.indexOf("export interface ClientAuthoritativeSettlement"),
  )
  for (const forbidden of ["outcome:", "delta:", "bankroll:", "resultSnapshot:"]) {
    assert.equal(clientInputContract.includes(forbidden), false, `round client must not submit ${forbidden}`)
  }
  assert.equal(tableClient.includes("expectedChipBalance"), false)
  assert.equal(memberData.includes("patchBody.expectedChipBalance"), false)
  assert.equal(memberData.includes("patchBody.delta"), false)
  assert.equal(memberData.includes("patchBody.outcome"), false)
})

test("CI workflow exposes release checks as separate required-job candidates", async () => {
  const workflow = await source("../.github/workflows/ci.yml")

  for (const job of ["quality", "security-tests", "build", "e2e"]) {
    assert.match(workflow, new RegExp(`^  ${job}:`, "m"), `CI must define ${job} job`)
  }
  assert.match(workflow, /Upload Playwright failure evidence/)
  assert.match(workflow, /retention-days: 7/)
})
