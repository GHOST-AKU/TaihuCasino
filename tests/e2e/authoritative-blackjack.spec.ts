import { expect, test, type APIRequestContext } from "@playwright/test"

const testAccount = {
  account: "e2e@taihu.casino",
  password: "not-a-secret-e2e-password",
}

type BlackjackRoundView = {
  roundId: string
  gameSlug: "blackjack"
  tableSessionId: string
  status: "active" | "settled" | "voided"
  phase: "insurance" | "player_turn" | "dealer_turn" | "settled" | "voided"
  version: number
  currentHandId: string | null
  allowedActions: string[]
  dealer: {
    cards: Array<{ rank: number; suit: string; hidden?: boolean }>
    holeCardHidden: boolean
    total: number | null
  }
  playerHands: Array<{
    handId: string
    cards: Array<{ rank: number; suit: string }>
    total: number
    bet: number
    status?: string
    delta?: number | null
    resultLabel?: string | null
  }>
  stake: number
  insuranceBet: number
  insuranceOffered: boolean
  totalCommittedStake: number
  chipBalanceBefore: number
  chipBalanceAfter: number
  delta: number
  summary: string
  round?: unknown
  serverTimestamp: string
  expiresAt: string
  idempotent: boolean
}

async function signIn(request: APIRequestContext) {
  const response = await request.post("/api/auth/login", { data: testAccount })
  expect(response.status()).toBe(200)
}

async function buyIn(request: APIRequestContext, key: string) {
  const response = await request.post("/api/member/table-sessions", {
    data: {
      gameSlug: "blackjack",
      buyInAmount: 500,
      idempotencyKey: key,
    },
  })
  expect(response.status()).toBe(200)
  return (await response.json()).tableSession as { id: string; chipBalance: number }
}

async function startRound(request: APIRequestContext, tableSessionId: string, idempotencyKey: string, stake = 20) {
  const response = await request.post("/api/member/game-rounds", {
    data: {
      gameSlug: "blackjack",
      tableSessionId,
      idempotencyKey,
      betSnapshot: {
        stake,
        forgedDealerCards: [{ rank: 1, suit: "spades" }],
        forgedOutcome: "win",
      },
    },
  })
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.blackjackRound).toBeTruthy()
  return body.blackjackRound as BlackjackRoundView
}

async function act(
  request: APIRequestContext,
  round: BlackjackRoundView,
  commandId: string,
  action: string,
) {
  const response = await request.post(`/api/member/game-rounds/${round.roundId}/actions`, {
    data: {
      commandId,
      expectedVersion: round.version,
      action,
      handId: round.currentHandId,
    },
  })
  expect(response.status(), `${action} should be accepted`).toBe(200)
  return await response.json()
}

async function normalizeInsurance(request: APIRequestContext, round: BlackjackRoundView) {
  if (!round.allowedActions.includes("skip_insurance")) return round
  const body = await act(request, round, "e2e-skip-insurance", "skip_insurance")
  return body.blackjackRound as BlackjackRoundView
}

test("blackjack deal restores an active server state and action commands are idempotent/versioned", async ({ request }) => {
  await signIn(request)
  const tableSession = await buyIn(request, "e2e-blackjack-state-buy-in")
  const first = await startRound(request, tableSession.id, "e2e-blackjack-state-round")

  expect(first.roundId).toEqual(expect.any(String))
  expect(first.tableSessionId).toBe(tableSession.id)
  expect(first.version).toBe(1)
  expect(first.status).toBe("active")
  expect(first.playerHands[0].cards.length).toBe(2)
  expect(first.dealer.cards.length).toBe(1)
  expect(first.dealer.holeCardHidden).toBe(true)
  expect(first.dealer.total).toBeNull()
  expect(first.round).toBeFalsy()

  const restored = await startRound(request, tableSession.id, "e2e-blackjack-state-round")
  expect(restored.roundId).toBe(first.roundId)
  expect(restored.version).toBe(first.version)
  expect(restored.idempotent).toBe(true)

  const active = await normalizeInsurance(request, restored)
  const action = active.allowedActions.includes("hit") ? "hit" : "stand"
  const actedBody = await act(request, active, "e2e-blackjack-command", action)
  const acted = actedBody.blackjackRound as BlackjackRoundView
  expect(acted.roundId).toBe(first.roundId)
  expect(acted.version).toBeGreaterThanOrEqual(active.version)

  const duplicate = await request.post(`/api/member/game-rounds/${first.roundId}/actions`, {
    data: {
      commandId: "e2e-blackjack-command",
      expectedVersion: active.version,
      action,
      handId: active.currentHandId,
    },
  })
  expect(duplicate.status()).toBe(200)
  const duplicateBody = await duplicate.json()
  expect(duplicateBody.idempotent).toBe(true)
  expect(duplicateBody.blackjackRound.roundId).toBe(first.roundId)
  expect(duplicateBody.blackjackRound.version).toBe(acted.version)

  const stale = await request.post(`/api/member/game-rounds/${first.roundId}/actions`, {
    data: {
      commandId: "e2e-blackjack-stale",
      expectedVersion: active.version,
      action: "stand",
      handId: active.currentHandId,
    },
  })
  expect(stale.status()).toBe(409)
})

test("cash-out is blocked while a blackjack round is still active", async ({ request }) => {
  await signIn(request)
  const tableSession = await buyIn(request, "e2e-blackjack-cashout-block-buy-in")
  const active = await startRound(request, tableSession.id, "e2e-blackjack-cashout-block-round")
  expect(active.status).toBe("active")

  const cashOut = await request.post(`/api/member/table-sessions/${tableSession.id}/cash-out`, {
    data: {
      idempotencyKey: "e2e-blackjack-cashout-block",
    },
  })
  expect(cashOut.status()).toBe(409)
  const body = await cashOut.json()
  expect(body.error).toMatch(/active blackjack round/i)
})

test("blackjack UI renders only server-returned cards and applies the final envelope", async ({ page }) => {
  await signIn(page.request)
  const tableSession = await buyIn(page.request, "e2e-blackjack-ui-buy-in")
  const roundId = "e2e-ui-blackjack-round"
  const handId = `${roundId}-h1`
  const activeRound: BlackjackRoundView = {
    roundId,
    gameSlug: "blackjack",
    tableSessionId: tableSession.id,
    status: "active",
    phase: "player_turn",
    version: 1,
    currentHandId: handId,
    allowedActions: ["stand"],
    dealer: {
      cards: [{ rank: 6, suit: "clubs" }],
      holeCardHidden: true,
      total: null,
    },
    playerHands: [{
      handId,
      cards: [
        { rank: 10, suit: "hearts" },
        { rank: 8, suit: "spades" },
      ],
      total: 18,
      bet: 20,
    }],
    stake: 20,
    insuranceBet: 0,
    insuranceOffered: false,
    totalCommittedStake: 20,
    chipBalanceBefore: 500,
    chipBalanceAfter: 500,
    delta: 0,
    summary: "",
    round: null,
    serverTimestamp: "2026-07-10T00:00:00.000Z",
    expiresAt: "2026-07-10T00:30:00.000Z",
    idempotent: false,
  }
  const summary = "Blackjack dealer 26; +20"
  const finalRound = {
    ...activeRound,
    status: "settled" as const,
    phase: "settled" as const,
    version: 2,
    currentHandId: null,
    allowedActions: [],
    dealer: {
      cards: [
        { rank: 6, suit: "clubs" },
        { rank: 13, suit: "diamonds" },
        { rank: 10, suit: "spades" },
      ],
      holeCardHidden: false,
      total: 26,
    },
    playerHands: [{
      ...activeRound.playerHands[0],
      status: "settled",
      delta: 20,
      resultLabel: "Won 20",
    }],
    chipBalanceAfter: 520,
    delta: 20,
    summary,
    round: {
      roundId,
      gameSlug: "blackjack",
      tableSessionId: tableSession.id,
      status: "settled",
      version: 1,
      outcome: "win",
      delta: 20,
      totalStake: 20,
      chipBalanceBefore: 500,
      chipBalanceAvailable: 520,
      chipBalanceAfter: 520,
      summary,
      betSnapshot: { stake: 20, totalStake: 20 },
      resultSnapshot: {
        dealerCards: [
          { rank: 6, suit: "clubs" },
          { rank: 13, suit: "diamonds" },
          { rank: 10, suit: "spades" },
        ],
        playerHands: activeRound.playerHands,
      },
      serverTimestamp: "2026-07-10T00:00:01.000Z",
      idempotent: false,
    },
  }

  await page.route("**/api/member/game-rounds", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        blackjackRound: activeRound,
        settlement: null,
        round: null,
        idempotent: false,
      }),
    })
  })
  await page.route(`**/api/member/game-rounds/${roundId}/actions`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        blackjackRound: finalRound,
        progress: { bankroll: 520 },
        settlement: finalRound.round,
        round: finalRound.round,
        idempotent: false,
      }),
    })
  })

  await page.goto("/games/blackjack?lang=en")
  await expect(page.getByRole("heading", { name: "Blackjack table" })).toBeVisible()
  await page.getByRole("button", { name: "Deal" }).click()

  await expect(page.getByTestId("blackjack-card-10-hearts")).toBeVisible()
  await expect(page.getByTestId("blackjack-card-8-spades")).toBeVisible()
  await expect(page.getByTestId("blackjack-card-6-clubs")).toBeVisible()
  await expect(page.getByTestId("blackjack-card-hidden")).toBeVisible()
  await expect(page.getByTestId("blackjack-card-K-diamonds")).toHaveCount(0)

  await page.getByRole("button", { name: "Stand" }).click()

  await expect(page.getByTestId("blackjack-card-hidden")).toHaveCount(0)
  await expect(page.getByTestId("blackjack-card-K-diamonds")).toBeVisible()
  await expect(page.getByText(summary, { exact: true })).toBeVisible()
  await expect(page.locator("main")).toHaveAttribute("data-round-id", roundId)
})
