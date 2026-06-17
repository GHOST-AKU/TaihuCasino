import { expect, test, type APIRequestContext } from "@playwright/test"

const testAccount = {
  account: "e2e@taihu.casino",
  password: "not-a-secret-e2e-password",
}

const coreTables = [
  {
    slug: "baccarat",
    betSnapshot: { bets: { player: 10, banker: 0, tie: 0, playerPair: 0, bankerPair: 0 } },
  },
  {
    slug: "blackjack",
    betSnapshot: { hands: [{ bet: 10, actions: ["stand"] }] },
  },
  {
    slug: "roulette",
    betSnapshot: { bets: [{ key: "red", amount: 10 }] },
  },
  {
    slug: "dice",
    betSnapshot: { bets: { big: 10, small: 0, odd: 0, even: 0, triple: 0 } },
  },
]

async function signIn(request: APIRequestContext) {
  const response = await request.post("/api/auth/login", {
    data: testAccount,
  })
  expect(response.status()).toBe(200)
  expect(response.headers()["cache-control"]).toContain("no-store")
  const body = await response.json()
  expect(body.session.account).toBe(testAccount.account)
}

test("public legal and support pages remain open and draft-marked", async ({ page }) => {
  for (const route of ["/terms", "/privacy", "/responsible-gaming", "/support"]) {
    await page.goto(route)
    await expect(page.getByText(/Engineering draft/i)).toBeVisible()
    await expect(page.locator("main")).toBeVisible()
  }
})

test("login establishes a member session and protects account-rights APIs from anonymous users", async ({ page }) => {
  const anonymousExport = await page.request.get("/api/member/data-export")
  expect(anonymousExport.status()).toBe(401)

  await signIn(page.request)
  await page.goto("/member/settings")

  await expect(page.getByText(/Account Rights/i)).toBeVisible()
  await expect(page.getByRole("link", { name: /Download JSON export/i })).toBeVisible()
  const session = await page.request.get("/api/auth/session")
  expect(session.status()).toBe(200)
  expect(session.headers()["cache-control"]).toContain("no-store")
  expect((await session.json()).session.account).toBe(testAccount.account)
})

test("four core tables support buy-in, authoritative round settlement, replay safety, and cash-out", async ({ request }) => {
  await signIn(request)

  for (const table of coreTables) {
    const buyIn = await request.post("/api/member/table-sessions", {
      data: {
        gameSlug: table.slug,
        buyInAmount: 500,
        idempotencyKey: `e2e-buyin-${table.slug}`,
      },
    })
    expect(buyIn.status(), `${table.slug} buy-in`).toBe(200)
    const buyInBody = await buyIn.json()
    const tableSession = buyInBody.tableSession
    expect(tableSession.gameSlug).toBe(table.slug)
    expect(tableSession.status).toBe("active")
    expect(tableSession.chipBalance).toBeGreaterThan(0)

    const roundPayload = {
      gameSlug: table.slug,
      tableSessionId: tableSession.id,
      idempotencyKey: `e2e-round-${table.slug}`,
      betSnapshot: table.betSnapshot,
      outcome: "win",
      delta: 999999,
      bankroll: 999999,
      resultSnapshot: { forged: true },
    }
    const round = await request.post("/api/member/game-rounds", { data: roundPayload })
    expect(round.status(), `${table.slug} round`).toBe(200)
    const roundBody = await round.json()
    expect(roundBody.settlement.totalStake).toBe(10)
    expect(roundBody.settlement.resultSnapshot.forged).toBeUndefined()

    const replay = await request.post("/api/member/game-rounds", { data: roundPayload })
    expect(replay.status(), `${table.slug} replay`).toBe(200)
    expect((await replay.json()).idempotent).toBe(true)

    const cashOut = await request.post(`/api/member/table-sessions/${tableSession.id}/cash-out`, {
      data: {
        idempotencyKey: `e2e-cashout-${table.slug}`,
        expectedChipBalance: 999999,
      },
    })
    expect(cashOut.status(), `${table.slug} cash-out`).toBe(200)
    const cashOutBody = await cashOut.json()
    expect(cashOutBody.tableSession.status).toBe("cashed_out")
    expect(cashOutBody.tableSession.chipBalance).toBe(0)
  }
})

test("cross-origin, unauthenticated, and stub credit bypass attempts do not succeed", async ({ request }) => {
  const crossOrigin = await request.post("/api/member/table-sessions", {
    headers: { origin: "https://attacker.example" },
    data: { gameSlug: "baccarat", buyInAmount: 100 },
  })
  expect(crossOrigin.status()).toBe(403)

  const anonymousRound = await request.post("/api/member/game-rounds", {
    data: {
      gameSlug: "baccarat",
      tableSessionId: "forged",
      idempotencyKey: "anonymous-forged-round",
      betSnapshot: { bets: { player: 10 } },
    },
  })
  expect(anonymousRound.status()).toBe(401)

  await signIn(request)
  const purchase = await request.post("/api/member/purchases", {
    data: { productId: "starter_credits", idempotencyKey: "e2e-stub-purchase" },
  })
  expect([200, 400]).toContain(purchase.status())

  const forgedPurchaseCredit = await request.post("/api/member/purchases/forged-purchase-id/complete", {
    data: { providerReference: "forged" },
  })
  expect(forgedPurchaseCredit.status()).not.toBe(200)

  const forgedAdCredit = await request.post("/api/member/ad-rewards/complete", {
    data: { rewardId: "forged-reward-id", placement: "daily_bonus" },
  })
  expect(forgedAdCredit.status()).not.toBe(200)
})
