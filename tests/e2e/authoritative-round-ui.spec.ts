import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const testAccount = {
  account: "e2e@taihu.casino",
  password: "not-a-secret-e2e-password",
}

type AuthoritativeRoundResponse = {
  progress: { bankroll: number }
  settlement: {
    outcome: "win" | "loss" | "push"
    delta: number
    totalStake: number
    summary: string
    resultSnapshot: Record<string, unknown>
  }
  round: {
    roundId: string
    gameSlug: string
    tableSessionId: string
    status: "settled"
    version: 1
    outcome: "win" | "loss" | "push"
    delta: number
    totalStake: number
    chipBalanceBefore: number
    chipBalanceAvailable: number
    chipBalanceAfter: number
    summary: string
    betSnapshot: Record<string, unknown>
    resultSnapshot: Record<string, unknown>
    serverTimestamp: string
    idempotent: boolean
  }
  idempotent: boolean
}

async function signIn(request: APIRequestContext) {
  const response = await request.post("/api/auth/login", { data: testAccount })
  expect(response.status()).toBe(200)
}

async function buyIn(page: Page, gameSlug: string, idempotencyKey: string, buyInAmount = 100) {
  const response = await page.request.post("/api/member/table-sessions", {
    data: {
      gameSlug,
      buyInAmount,
      idempotencyKey,
    },
  })
  expect(response.status()).toBe(200)
  return (await response.json()).tableSession as { id: string; chipBalance: number }
}

async function delayGameRound(page: Page, body: AuthoritativeRoundResponse) {
  let releaseSettlement!: () => void
  const settlementGate = new Promise<void>((resolve) => {
    releaseSettlement = resolve
  })
  let requestStarted!: () => void
  const requestStart = new Promise<void>((resolve) => {
    requestStarted = resolve
  })

  await page.route("**/api/member/game-rounds", async (route) => {
    requestStarted()
    await settlementGate
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    })
  })

  return { releaseSettlement, requestStart }
}

function bankroll(page: Page) {
  return page.locator("p.text-5xl").first()
}

function metric(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator("..")
}

function authoritativeResponse({
  roundId,
  gameSlug,
  tableSessionId,
  outcome,
  delta,
  totalStake,
  chipBalanceBefore,
  chipBalanceAfter,
  summary,
  betSnapshot,
  resultSnapshot,
}: {
  roundId: string
  gameSlug: string
  tableSessionId: string
  outcome: "win" | "loss" | "push"
  delta: number
  totalStake: number
  chipBalanceBefore: number
  chipBalanceAfter: number
  summary: string
  betSnapshot: Record<string, unknown>
  resultSnapshot: Record<string, unknown>
}): AuthoritativeRoundResponse {
  return {
    progress: { bankroll: chipBalanceAfter },
    settlement: {
      outcome,
      delta,
      totalStake,
      summary,
      resultSnapshot,
    },
    round: {
      roundId,
      gameSlug,
      tableSessionId,
      status: "settled",
      version: 1,
      outcome,
      delta,
      totalStake,
      chipBalanceBefore,
      chipBalanceAvailable: chipBalanceBefore,
      chipBalanceAfter,
      summary,
      betSnapshot,
      resultSnapshot,
      serverTimestamp: "2026-07-07T00:00:00.000Z",
      idempotent: false,
    },
    idempotent: false,
  }
}

test("dice keeps bankroll and derived results unchanged until the authoritative round arrives", async ({ page }) => {
  await signIn(page.request)
  const tableSession = await buyIn(page, "dice", "e2e-authoritative-dice-buy-in")
  const summary = "Dice 6+6+6=18; +1200"
  const { releaseSettlement, requestStart } = await delayGameRound(page, authoritativeResponse({
    roundId: "e2e-authoritative-dice-round",
    gameSlug: "dice",
    tableSessionId: tableSession.id,
    outcome: "win",
    delta: 1200,
    totalStake: 50,
    chipBalanceBefore: 100,
    chipBalanceAfter: 1300,
    summary,
    betSnapshot: { bets: { small: 50 } },
    resultSnapshot: { dice: [6, 6, 6], sum: 18, triple: true },
  }))

  await page.goto("/games/dice?lang=en")
  await page.getByRole("button", { name: /^SMALL\b/ }).click()

  await expect(bankroll(page)).toContainText("100")
  await expect(metric(page, "Round delta")).toContainText("+0")

  await page.getByRole("button", { name: "Roll", exact: true }).click()
  await requestStart

  await expect(bankroll(page)).toContainText("100")
  await expect(metric(page, "Round delta")).toContainText("+0")

  releaseSettlement()

  await expect(bankroll(page)).toContainText("1,300")
  await expect(metric(page, "Round delta")).toContainText("1,200")
  await expect(page.locator("main")).toHaveAttribute("data-round-id", "e2e-authoritative-dice-round")
  await expect(page.getByText(summary, { exact: true })).toBeVisible()
})

test("roulette waits for the authoritative envelope and screenshots the final number", async ({ page }) => {
  await signIn(page.request)
  const tableSession = await buyIn(page, "roulette", "e2e-authoritative-roulette-buy-in")
  const summary = "Roulette 7 red; +50"
  const { releaseSettlement, requestStart } = await delayGameRound(page, authoritativeResponse({
    roundId: "e2e-authoritative-roulette-round",
    gameSlug: "roulette",
    tableSessionId: tableSession.id,
    outcome: "win",
    delta: 50,
    totalStake: 50,
    chipBalanceBefore: 100,
    chipBalanceAfter: 150,
    summary,
    betSnapshot: { bets: [{ key: "straight:7", amount: 50 }] },
    resultSnapshot: { result: 7, color: "red", rng: "e2e" },
  }))

  await page.goto("/games/roulette?lang=en")
  await expect(page.getByRole("heading", { name: "Roulette Hall" })).toBeVisible()
  await page.getByRole("button", { name: "7", exact: true }).click()

  await expect(bankroll(page)).toContainText("100")
  await expect(metric(page, "Bet count")).toContainText("1")
  await expect(metric(page, "Last delta")).toContainText("+0")

  await page.getByRole("button", { name: "Spin", exact: true }).click()
  await requestStart

  await expect(bankroll(page)).toContainText("100")
  await expect(metric(page, "Last delta")).toContainText("+0")

  releaseSettlement()

  await expect(page.locator("main")).toHaveAttribute("data-round-id", "e2e-authoritative-roulette-round", {
    timeout: 15_000,
  })
  await expect(bankroll(page)).toContainText("150")
  await expect(metric(page, "Last delta")).toContainText("+50")
  await expect(page.getByText(summary, { exact: true })).toBeVisible()
  await expect(page.getByText(/Pointer:\s*7/)).toBeVisible()
  const finalWheel = await page.locator("canvas").screenshot()
  expect(finalWheel.length).toBeGreaterThan(1_000)
})

test("baccarat deals only the server-provided cards after the authoritative round returns", async ({ page }) => {
  await signIn(page.request)
  const tableSession = await buyIn(page, "baccarat", "e2e-authoritative-baccarat-buy-in")
  const resultSnapshot = {
    winner: "P",
    playerPoint: 9,
    bankerPoint: 1,
    playerPair: false,
    bankerPair: false,
    playerCards: [
      { rank: 9, suit: "hearts" },
      { rank: 13, suit: "clubs" },
    ],
    bankerCards: [
      { rank: 1, suit: "spades" },
      { rank: 10, suit: "diamonds" },
    ],
    rng: "e2e",
  }
  const summary = "Baccarat Player 9 vs Banker 1; +25"
  const { releaseSettlement, requestStart } = await delayGameRound(page, authoritativeResponse({
    roundId: "e2e-authoritative-baccarat-round",
    gameSlug: "baccarat",
    tableSessionId: tableSession.id,
    outcome: "win",
    delta: 25,
    totalStake: 25,
    chipBalanceBefore: 100,
    chipBalanceAfter: 125,
    summary,
    betSnapshot: { bets: { player: 25, banker: 0, tie: 0, playerPair: 0, bankerPair: 0 } },
    resultSnapshot,
  }))

  await page.goto("/games/baccarat?lang=en")
  await expect(page.getByRole("heading", { name: "Baccarat Main Table" })).toBeVisible()
  await page.getByRole("button", { name: /^Player Pays 1:1/ }).click()

  await expect(bankroll(page)).toContainText("100")
  await expect(metric(page, "Bet count")).toContainText("1")
  await expect(metric(page, "Last delta")).toContainText("+0")

  await page.getByRole("button", { name: "Deal", exact: true }).click()
  await requestStart

  await expect(bankroll(page)).toContainText("100")
  await expect(metric(page, "Last delta")).toContainText("+0")
  await expect(page.getByText("9♥")).toHaveCount(0)
  await expect(page.getByText("K♣")).toHaveCount(0)

  releaseSettlement()

  await expect(page.locator("main")).toHaveAttribute("data-round-id", "e2e-authoritative-baccarat-round")
  await expect(bankroll(page)).toContainText("125")
  await expect(metric(page, "Last delta")).toContainText("+25")
  await expect(page.getByText("9♥")).toBeVisible()
  await expect(page.getByText("K♣")).toBeVisible()
  await expect(page.getByText("A♠")).toBeVisible()
  await expect(page.getByText("10♦")).toBeVisible()
  await expect(page.getByText(summary, { exact: true })).toBeVisible()
})
