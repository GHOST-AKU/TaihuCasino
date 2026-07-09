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

async function signIn(request: APIRequestContext, requestId = "e2e-login-request") {
  const response = await request.post("/api/auth/login", {
    headers: { "x-request-id": requestId },
    data: testAccount,
  })
  expect(response.status()).toBe(200)
  expect(response.headers()["cache-control"]).toContain("no-store")
  expect(response.headers()["x-request-id"]).toBe(requestId)
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

test("login fits a normal desktop while short viewports keep natural overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 878 })
  await page.goto("/login")

  await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible()

  const desktop = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    panelBottom: document.querySelector(".casino-auth-panel")?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
  }))
  expect(desktop.scrollHeight).toBeLessThanOrEqual(desktop.clientHeight + 1)
  expect(desktop.panelBottom).toBeLessThanOrEqual(desktop.clientHeight)

  await page.setViewportSize({ width: 1538, height: 586 })
  const shortViewport = await page.evaluate(() => {
    const panel = document.querySelector(".casino-auth-panel")
    return {
      clientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
      panelDisplay: panel ? window.getComputedStyle(panel).display : "",
    }
  })
  expect(shortViewport.scrollHeight).toBeGreaterThan(shortViewport.clientHeight)
  expect(shortViewport.panelDisplay).toBe("block")
})

test("password recovery routes are public and validate the recovery forms", async ({ page }) => {
  let recoveryRequest: { email?: string; captchaToken?: string } | null = null
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `window.turnstile = {
        render: (_container, options) => {
          setTimeout(() => options.callback("e2e-turnstile-token"), 500)
          return "e2e-widget"
        },
        reset: () => {},
        remove: () => {}
      }`,
    })
  })
  await page.route("**/api/auth/password-reset/request", async (route) => {
    recoveryRequest = route.request().postDataJSON()
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ message: "If an account exists for this email, a password reset link is on its way." }),
    })
  })

  await page.goto("/login")
  await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password")

  await page.getByRole("link", { name: "Forgot password?" }).click()
  await expect(page.getByRole("heading", { name: "Recover access" })).toBeVisible()
  await page.getByLabel("Email address").fill("player@example.com")
  await page.getByRole("button", { name: "Send reset link" }).click()
  await expect(page.getByRole("dialog", { name: "Security check" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
  await expect(page.getByText("player@example.com")).toBeVisible()
  expect(recoveryRequest).toEqual({ email: "player@example.com", captchaToken: "e2e-turnstile-token" })

  await page.goto("/reset-password")
  await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible()
  await page.getByLabel("New password", { exact: true }).fill("short")
  await page.getByLabel("Confirm new password", { exact: true }).fill("short")
  await page.getByRole("button", { name: "Update password" }).click()
  await expect(page.getByText("Password must be at least 8 characters.")).toBeVisible()

  const invalidRequest = await page.request.post("/api/auth/password-reset/request", { data: { email: "invalid" } })
  expect(invalidRequest.status()).toBe(400)
  const crossOriginUpdate = await page.request.post("/api/auth/password-reset/update", {
    headers: { origin: "https://attacker.example" },
    data: { password: "a-valid-new-password" },
  })
  expect(crossOriginUpdate.status()).toBe(403)
})

test("password sign-in sends the Turnstile token with credentials", async ({ page }) => {
  let loginRequest: { account?: string; password?: string; captchaToken?: string } | null = null
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `window.turnstile = {
        render: (_container, options) => {
          setTimeout(() => options.callback("e2e-login-turnstile-token"), 500)
          return "e2e-login-widget"
        },
        getResponse: () => "e2e-login-turnstile-token",
        reset: () => {},
        remove: () => {}
      }`,
    })
  })
  await page.route("**/api/auth/login", async (route) => {
    loginRequest = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          account: "demo@taihu.casino",
          displayName: "Demo",
          loginAt: new Date().toISOString(),
          provider: "supabase",
        },
      }),
    })
  })

  await page.goto("/login")
  await page.getByLabel("Email Address").fill("demo@taihu.casino")
  await page.locator("#password").fill("12345678")
  await page.getByRole("button", { name: "Sign In", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Security check" })).toBeVisible()

  await expect.poll(() => loginRequest).toEqual({
    account: "demo@taihu.casino",
    password: "12345678",
    captchaToken: "e2e-login-turnstile-token",
  })
})

test("four core tables support buy-in, authoritative round settlement, replay safety, and cash-out", async ({ request }) => {
  await signIn(request)

  for (const table of coreTables) {
    const buyIn = await request.post("/api/member/table-sessions", {
      headers: { "x-request-id": `e2e-${table.slug}-buy-in` },
      data: {
        gameSlug: table.slug,
        buyInAmount: 500,
        idempotencyKey: `e2e-buyin-${table.slug}`,
      },
    })
    expect(buyIn.status(), `${table.slug} buy-in`).toBe(200)
    expect(buyIn.headers()["x-request-id"]).toBe(`e2e-${table.slug}-buy-in`)
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
    const round = await request.post("/api/member/game-rounds", {
      headers: { "x-request-id": `e2e-${table.slug}-round` },
      data: roundPayload,
    })
    expect(round.status(), `${table.slug} round`).toBe(200)
    expect(round.headers()["x-request-id"]).toBe(`e2e-${table.slug}-round`)
    const roundBody = await round.json()
    expect(roundBody.settlement.totalStake).toBe(10)
    expect(roundBody.settlement.resultSnapshot.forged).toBeUndefined()
    expect(roundBody.round.roundId).toEqual(expect.any(String))
    expect(roundBody.round.gameSlug).toBe(table.slug)
    expect(roundBody.round.tableSessionId).toBe(tableSession.id)
    expect(roundBody.round.status).toBe("settled")
    expect(roundBody.round.version).toBe(1)
    expect(roundBody.round.totalStake).toBe(10)
    expect(roundBody.round.delta).toBe(roundBody.settlement.delta)
    expect(roundBody.round.summary).toBe(roundBody.settlement.summary)
    expect(roundBody.round.chipBalanceBefore).toBe(tableSession.chipBalance)
    expect(roundBody.round.chipBalanceAfter).toBe(roundBody.progress.bankroll)
    expect(roundBody.round.resultSnapshot.forged).toBeUndefined()
    expect(roundBody.round.idempotent).toBe(false)

    const replay = await request.post("/api/member/game-rounds", { data: roundPayload })
    expect(replay.status(), `${table.slug} replay`).toBe(200)
    const replayBody = await replay.json()
    expect(replayBody.idempotent).toBe(true)
    expect(replayBody.round.roundId).toBe(roundBody.round.roundId)
    expect(replayBody.round.tableSessionId).toBe(tableSession.id)
    expect(replayBody.round.chipBalanceAfter).toBe(roundBody.round.chipBalanceAfter)
    expect(replayBody.round.idempotent).toBe(true)

    const cashOut = await request.post(`/api/member/table-sessions/${tableSession.id}/cash-out`, {
      headers: { "x-request-id": `e2e-${table.slug}-cash-out` },
      data: {
        idempotencyKey: `e2e-cashout-${table.slug}`,
        expectedChipBalance: roundBody.round.chipBalanceAfter,
      },
    })
    expect(cashOut.status(), `${table.slug} cash-out`).toBe(200)
    expect(cashOut.headers()["x-request-id"]).toBe(`e2e-${table.slug}-cash-out`)
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
