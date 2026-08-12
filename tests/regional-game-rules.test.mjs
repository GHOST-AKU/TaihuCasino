import assert from "node:assert/strict"
import test from "node:test"

import {
  CROWN_ANCHOR_RULES,
  FAN_TAN_RULES,
  FISH_PRAWN_CRAB_RULES,
  FRENCH_BOULE_RULES,
  MAX_BET_AMOUNT,
  MAX_BET_ENTRIES,
  REGIONAL_GAME_RULE_IDS,
  REGIONAL_GAME_RULES,
  SIC_BO_RULES,
  SIC_BO_NET_ODDS,
  evaluateSicBoBets,
  settleFanTanRound,
  settleFrenchBouleRound,
  settleSicBoRound,
  settleSymbolDiceRound,
} from "../lib/game-rules/index.ts"

function sequenceRandomInt(...values) {
  let cursor = 0
  return (max) => {
    const value = values[cursor]
    cursor += 1
    assert.ok(Number.isInteger(value) && value >= 0 && value < max, `${value} is invalid for randomInt(${max})`)
    return value
  }
}

test("regional metadata exposes canonical UI options, odds, probability, and EV", () => {
  assert.deepEqual(Object.keys(REGIONAL_GAME_RULES), [
    "fish-prawn-crab",
    "crown-anchor",
    "fan-tan",
    "french-boule",
  ])
  assert.deepEqual(REGIONAL_GAME_RULE_IDS, Object.keys(REGIONAL_GAME_RULES))

  for (const [id, rules] of Object.entries(REGIONAL_GAME_RULES)) {
    assert.equal(rules.id, id)
    assert.ok(rules.labels.en && rules.labels.zh)
    assert.ok(rules.shortDescription.en && rules.shortDescription.zh)
    assert.ok(rules.betOptions.length > 0)
    for (const option of rules.betOptions) {
      assert.ok(option.labels.en && option.labels.zh)
      assert.ok(option.netOdds.min >= 0 && option.netOdds.max >= option.netOdds.min)
      assert.ok(option.probability > 0 && option.probability <= 1)
      assert.ok(Number.isFinite(option.expectedValue))
    }
  }
  for (const option of SIC_BO_RULES.betOptions) {
    assert.equal(option.netOdds.min, SIC_BO_NET_ODDS[option.key])
    assert.equal(option.netOdds.max, SIC_BO_NET_ODDS[option.key])
  }
})

test("fish-prawn-crab and crown-and-anchor keep independent symbol whitelists", () => {
  const fishRound = settleSymbolDiceRound(
    FISH_PRAWN_CRAB_RULES,
    { bets: [{ key: "fish", amount: 10 }, { key: "crown", amount: 10 }] },
    sequenceRandomInt(0, 0, 1),
  )
  assert.deepEqual(fishRound.betSnapshot.bets, [{ key: "fish", amount: 10 }])
  assert.deepEqual(fishRound.resultSnapshot.symbols, ["fish", "fish", "prawn"])
  assert.equal(fishRound.delta, 20)

  const crownRound = settleSymbolDiceRound(
    CROWN_ANCHOR_RULES,
    { bets: { fish: 10, crown: 10 } },
    sequenceRandomInt(0, 1, 2),
  )
  assert.deepEqual(crownRound.betSnapshot.bets, [{ key: "crown", amount: 10 }])
  assert.deepEqual(crownRound.resultSnapshot.symbols, ["crown", "anchor", "heart"])
  assert.equal(crownRound.delta, 10)
})

test("fan-tan settles the server-generated one-to-four remainder", () => {
  const round = settleFanTanRound(
    { bets: [{ key: "remainder:3", amount: 10 }] },
    sequenceRandomInt(2, 0),
  )
  assert.equal(round.resultSnapshot.remainder, 3)
  assert.equal(round.resultSnapshot.beadCount, 35)
  assert.equal(round.delta, 28.5)
  assert.equal(round.rulesVersion, FAN_TAN_RULES.rulesVersion)
})

test("French Boule treats yellow five as the house number for even-chance bets", () => {
  const round = settleFrenchBouleRound(
    { bets: [{ key: "red", amount: 10 }, { key: "number:5", amount: 10 }] },
    sequenceRandomInt(4),
  )
  assert.equal(round.resultSnapshot.result, 5)
  assert.equal(round.resultSnapshot.color, "yellow")
  assert.deepEqual(round.resultSnapshot.winningKeys, ["number:5"])
  assert.equal(round.delta, 60)
  assert.equal(round.rulesVersion, FRENCH_BOULE_RULES.rulesVersion)
})

test("Sic Bo triples defeat big, small, odd, and even", () => {
  assert.deepEqual(evaluateSicBoBets([6, 6, 6]), {
    big: false,
    small: false,
    odd: false,
    even: false,
    triple: true,
  })

  const round = settleSicBoRound(
    { bets: { big: 10, even: 10, triple: 10 } },
    sequenceRandomInt(5, 5, 5),
  )
  assert.equal(round.delta, 220)
  assert.equal(round.resultSnapshot.triple, true)
  assert.deepEqual(round.resultSnapshot.winningKeys, ["triple"])
  assert.equal(round.rulesVersion, SIC_BO_RULES.rulesVersion)
})

test("canonical bet safety rejects empty ledgers, oversized amounts, and invalid RNG output", () => {
  assert.throws(
    () => settleFanTanRound(
      { bets: Array.from({ length: MAX_BET_ENTRIES + 1 }, () => ({ key: "remainder:1", amount: 1 })) },
      sequenceRandomInt(0, 0),
    ),
    /at most 100 bet entries/,
  )
  assert.throws(
    () => settleFanTanRound({ bets: [{ key: "unknown", amount: 10 }] }, sequenceRandomInt(0, 0)),
    /At least one valid bet is required/,
  )
  assert.throws(
    () => settleFanTanRound(
      { bets: [{ key: "remainder:1", amount: MAX_BET_AMOUNT + 1 }] },
      sequenceRandomInt(0, 0),
    ),
    /At least one valid bet is required/,
  )
  assert.throws(
    () => settleFanTanRound({ bets: { "remainder:1": 10 } }, () => 4),
    /server random source returned an invalid value/,
  )
})
