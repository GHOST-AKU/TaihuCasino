import assert from "node:assert/strict"
import test from "node:test"

import {
  BlackjackVersionConflictError,
  applyBlackjackCommand,
  createBlackjackRoundState,
  publicBlackjackView,
  voidExpiredBlackjackRound,
} from "../lib/blackjack-engine.ts"

const baseInput = {
  roundId: "00000000-0000-4000-8000-000000000001",
  gameSlug: "blackjack",
  tableSessionId: "11111111-1111-4111-8111-111111111111",
  stake: 10,
  chipBalanceBefore: 100,
  idempotencyKey: "engine-deal",
  nowIso: "2026-07-10T00:00:00.000Z",
}

function card(rank, suit = "hearts") {
  return { rank, suit }
}

function startWith(deck, overrides = {}) {
  return createBlackjackRoundState({
    ...baseInput,
    ...overrides,
    deck,
  })
}

test("deal exposes only server-visible blackjack cards and actions", () => {
  const state = startWith([
    card(10, "hearts"),
    card(6, "clubs"),
    card(8, "spades"),
    card(1, "diamonds"),
    card(3, "clubs"),
  ])
  const view = publicBlackjackView(state)

  assert.equal(view.roundId, baseInput.roundId)
  assert.equal(view.version, 1)
  assert.equal(view.phase, "player_turn")
  assert.deepEqual(view.playerHands[0].cards.map((visible) => visible.rank), [10, 8])
  assert.deepEqual(view.dealer.cards.map((visible) => visible.rank), [6])
  assert.equal(view.dealer.holeCardHidden, true)
  assert.equal(view.dealer.total, null)
  assert.deepEqual(view.allowedActions.sort(), ["double", "hit", "stand"])
})

test("hit is versioned, repeatable by command id, and stale commands return 409 semantics", () => {
  const state = startWith([
    card(10),
    card(6, "clubs"),
    card(8, "spades"),
    card(9, "diamonds"),
    card(2, "clubs"),
    card(5, "spades"),
  ])
  const handId = publicBlackjackView(state).currentHandId
  const hit = applyBlackjackCommand(state, {
    commandId: "cmd-hit",
    expectedVersion: 1,
    action: "hit",
    handId,
  }, "2026-07-10T00:00:01.000Z")

  assert.equal(hit.blackjackRound.version, 2)
  assert.equal(hit.blackjackRound.playerHands[0].cards.length, 3)
  assert.equal(hit.blackjackRound.playerHands[0].cards[2].rank, 2)
  assert.equal(hit.idempotent, false)

  const duplicate = applyBlackjackCommand(hit.state, {
    commandId: "cmd-hit",
    expectedVersion: 1,
    action: "hit",
    handId,
  }, "2026-07-10T00:00:02.000Z")

  assert.equal(duplicate.idempotent, true)
  assert.equal(duplicate.blackjackRound.version, hit.blackjackRound.version)
  assert.deepEqual(duplicate.blackjackRound.playerHands, hit.blackjackRound.playerHands)

  assert.throws(
    () => applyBlackjackCommand(hit.state, {
      commandId: "cmd-stale",
      expectedVersion: 1,
      action: "stand",
      handId,
    }, "2026-07-10T00:00:03.000Z"),
    BlackjackVersionConflictError,
  )
})

test("double commits one extra stake, draws exactly one server card, and returns the final envelope", () => {
  const state = startWith([
    card(5, "hearts"),
    card(9, "clubs"),
    card(6, "spades"),
    card(7, "diamonds"),
    card(10, "clubs"),
    card(10, "spades"),
  ])
  const handId = publicBlackjackView(state).currentHandId
  const result = applyBlackjackCommand(state, {
    commandId: "cmd-double",
    expectedVersion: 1,
    action: "double",
    handId,
  }, "2026-07-10T00:00:01.000Z")

  assert.equal(result.blackjackRound.status, "settled")
  assert.equal(result.round?.roundId, baseInput.roundId)
  assert.equal(result.round?.totalStake, 20)
  assert.equal(result.round?.delta, 20)
  assert.equal(result.round?.chipBalanceBefore, 100)
  assert.equal(result.round?.chipBalanceAfter, 120)
  assert.deepEqual(result.round?.resultSnapshot.playerHands[0].cards.map((visible) => visible.rank), [5, 6, 10])
})

test("split creates independent hands from server deck without client-side card generation", () => {
  const state = startWith([
    card(8, "hearts"),
    card(6, "clubs"),
    card(8, "spades"),
    card(10, "diamonds"),
    card(3, "clubs"),
    card(2, "spades"),
  ])
  const handId = publicBlackjackView(state).currentHandId
  const result = applyBlackjackCommand(state, {
    commandId: "cmd-split",
    expectedVersion: 1,
    action: "split",
    handId,
  }, "2026-07-10T00:00:01.000Z")

  assert.equal(result.blackjackRound.status, "active")
  assert.equal(result.blackjackRound.version, 2)
  assert.equal(result.blackjackRound.totalCommittedStake, 20)
  assert.equal(result.blackjackRound.playerHands.length, 2)
  assert.deepEqual(result.blackjackRound.playerHands.map((hand) => hand.cards.map((visible) => visible.rank)), [[8, 3], [8, 2]])
  assert.equal(result.round, null)
})

test("insurance resolves from hidden server dealer card and never from client claims", () => {
  const state = startWith([
    card(10, "hearts"),
    card(1, "clubs"),
    card(7, "spades"),
    card(13, "diamonds"),
  ])
  const initial = publicBlackjackView(state)
  assert.equal(initial.phase, "insurance")
  assert.deepEqual(initial.allowedActions.sort(), ["buy_insurance", "skip_insurance"])
  assert.equal(initial.dealer.holeCardHidden, true)

  const result = applyBlackjackCommand(state, {
    commandId: "cmd-insurance",
    expectedVersion: 1,
    action: "buy_insurance",
  }, "2026-07-10T00:00:01.000Z")

  assert.equal(result.blackjackRound.status, "settled")
  assert.equal(result.round?.delta, 0)
  assert.equal(result.round?.outcome, "push")
  assert.equal(result.round?.totalStake, 15)
  assert.equal(result.round?.resultSnapshot.dealerCards.length, 2)
  assert.equal(result.round?.resultSnapshot.insuranceBet, 5)
})

test("expired active blackjack rounds void without changing chips or creating a final round", () => {
  const state = startWith([
    card(10),
    card(6, "clubs"),
    card(8, "spades"),
    card(9, "diamonds"),
  ], {
    nowIso: "2026-07-10T00:00:00.000Z",
  })

  const voided = voidExpiredBlackjackRound(state, "2026-07-10T00:31:00.000Z")
  const view = publicBlackjackView(voided)

  assert.equal(view.status, "voided")
  assert.equal(view.phase, "voided")
  assert.equal(view.round, null)
  assert.equal(view.chipBalanceBefore, 100)
  assert.equal(view.chipBalanceAfter, 100)
})
