import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { settleAuthoritativeRound } from "../lib/authoritative-settlement.ts"
import { REGIONAL_GAME_RULE_IDS } from "../lib/game-rules/index.ts"

function sequence(values) {
  let index = 0
  return (max) => {
    const value = values[index++]
    assert.ok(Number.isInteger(value) && value >= 0 && value < max)
    return value
  }
}

test("baccarat ignores client outcomes and calculates from canonical bets", () => {
  const result = settleAuthoritativeRound(
    "baccarat",
    { bets: { player: 10, banker: 0, tie: 0, playerPair: 0, bankerPair: 0 } },
    sequence([8, 0, 12, 1, 0, 2, 9, 3]),
  )

  assert.equal(result.outcome, "win")
  assert.equal(result.delta, 10)
  assert.equal(result.totalStake, 10)
  assert.equal(result.resultSnapshot.winner, "P")
  assert.equal(result.resultSnapshot.playerCards.length, 2)
  assert.equal(result.resultSnapshot.bankerCards.length, 2)
})

test("dice uses server RNG and fixed server payouts", () => {
  const result = settleAuthoritativeRound(
    "dice",
    { bets: { big: 10, triple: 10 } },
    sequence([0, 0, 0]),
  )

  assert.deepEqual(result.resultSnapshot.dice, [1, 1, 1])
  assert.equal(result.delta, 230)
  assert.equal(result.totalStake, 20)
})

test("regional tables dispatch through the authoritative settlement boundary", () => {
  const cases = [
    ["fish-prawn-crab", { bets: [{ key: "fish", amount: 10 }] }, [0, 0, 1], "fish"],
    ["crown-anchor", { bets: [{ key: "anchor", amount: 10 }] }, [1, 2, 3], "anchor"],
    ["fan-tan", { bets: [{ key: "remainder:2", amount: 10 }] }, [1, 0], "remainder"],
    ["french-boule", { bets: [{ key: "number:9", amount: 10 }] }, [8], "result"],
  ]

  assert.deepEqual(cases.map(([ruleSet]) => ruleSet), REGIONAL_GAME_RULE_IDS)

  for (const [ruleSet, betSnapshot, rngValues, resultKey] of cases) {
    const result = settleAuthoritativeRound(ruleSet, betSnapshot, sequence(rngValues))
    assert.equal(result.totalStake, 10)
    assert.equal(result.resultSnapshot.ruleSet, ruleSet)
    assert.ok(resultKey in result.resultSnapshot)
    assert.match(result.resultSnapshot.rulesVersion, /\d/)
    assert.equal(result.betSnapshot.ruleSet, ruleSet)
  }
})

test("roulette ignores forged numbers and payout fields", () => {
  const result = settleAuthoritativeRound(
    "roulette",
    { bets: [{ key: "straight:1", amount: 10, numbers: [1, 2, 3], payout: 999999 }] },
    sequence([1]),
  )

  assert.equal(result.delta, 350)
  assert.deepEqual(result.betSnapshot.bets, [{ key: "straight:1", amount: 10 }])
})

test("roulette rejects an unknown forged bet", () => {
  assert.throws(
    () => settleAuthoritativeRound(
      "roulette",
      { bets: [{ key: "forged:any-number", amount: 1000000, payout: 1000000 }] },
      sequence([1]),
    ),
    /valid bet/i,
  )
})

test("blackjack cannot use the generic one-step settlement path", () => {
  assert.throws(
    () => settleAuthoritativeRound(
      "blackjack",
      { hands: [{ bet: 10, actions: ["stand"] }] },
      sequence([9, 6, 5, 5]),
    ),
    /state machine/i,
  )
})

test("client contracts and database migration close direct-write boundaries", async () => {
  const [roundClient, cashOutClient, memberData, migration] = await Promise.all([
    readFile(new URL("../lib/member-round-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/table-session-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/member-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260610160000_authoritative_settlement_boundary.sql", import.meta.url), "utf8"),
  ])

  const clientInputContract = roundClient.slice(
    roundClient.indexOf("export interface ClientGameRoundInput"),
    roundClient.indexOf("export interface ClientAuthoritativeSettlement"),
  )
  for (const forbidden of ["outcome:", "delta:", "bankroll:", "resultSnapshot:"]) {
    assert.equal(clientInputContract.includes(forbidden), false)
  }
  assert.equal(cashOutClient.includes("expectedChipBalance"), false)
  assert.equal(memberData.includes("patchBody.expectedChipBalance"), false)
  assert.equal(memberData.includes("patchBody.delta"), false)
  assert.equal(memberData.includes("patchBody.outcome"), false)
  assert.match(memberData, /settlement: settlementFromGameRound\(existingRound\)/)
  assert.match(migration, /normalized_stake <= 0 or normalized_stake > balance_before/)
  assert.match(migration, /revoke insert, update on table public\.member_game_progress from authenticated/)
  assert.match(migration, /revoke insert on table public\.member_events from authenticated/)
})

test("baccarat presentation settles a six-card hand within two seconds", async () => {
  const source = await readFile(new URL("../components/baccarat-table-page.tsx", import.meta.url), "utf8")
  const readDelay = (name) => {
    const match = source.match(new RegExp(`const ${name} = (\\d+)`))
    assert.ok(match, `${name} must remain an explicit timing constant`)
    return Number(match[1])
  }
  const initialDealMatch = source.match(/index === 0 \? (\d+) : dealCardDelayMs/)
  assert.ok(initialDealMatch, "initial deal delay must remain explicit")

  const initialDealDelay = Number(initialDealMatch[1])
  const dealCardDelay = readDelay("dealCardDelayMs")
  const pointCheckDelay = readDelay("pointCheckDelayMs")
  const settlementDelay = readDelay("settlementDelayMs")
  const sixCardPresentationDelay = initialDealDelay
    + (5 * dealCardDelay)
    + pointCheckDelay
    + settlementDelay

  assert.ok(settlementDelay <= 300, `final settlement pause is ${settlementDelay}ms`)
  assert.ok(sixCardPresentationDelay <= 2000, `six-card presentation takes ${sixCardPresentationDelay}ms`)
})
