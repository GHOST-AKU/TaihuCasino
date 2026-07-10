import { randomInt } from "node:crypto"

import type { RoundEnvelope, RoundOutcome } from "@/lib/game-round-contract"

export type BlackjackSuit = "spades" | "hearts" | "diamonds" | "clubs"
export type BlackjackAction = "hit" | "stand" | "double" | "split" | "buy_insurance" | "skip_insurance"
export type BlackjackPhase = "insurance" | "player_turn" | "dealer_turn" | "settled" | "voided"
export type BlackjackRoundStatus = "active" | "settled" | "voided"
export type BlackjackHandStatus = "active" | "standing" | "busted" | "settled"

export interface BlackjackCard {
  rank: number
  suit: BlackjackSuit
}

export interface BlackjackVisibleCard extends BlackjackCard {
  hidden?: boolean
}

export interface BlackjackHandState {
  handId: string
  cards: BlackjackCard[]
  bet: number
  status: BlackjackHandStatus
  fromSplit: boolean
  doubled: boolean
  naturalBlackjack: boolean
  delta: number | null
  resultLabel: string | null
}

export interface BlackjackCommandReplay {
  commandId: string
  expectedVersion: number
  action: BlackjackAction
  handId: string | null
  blackjackRound: BlackjackRoundView
  round: RoundEnvelope | null
  settlement: BlackjackSettlement | null
}

export interface BlackjackRoundState {
  roundId: string
  gameSlug: string
  tableSessionId: string
  status: BlackjackRoundStatus
  phase: BlackjackPhase
  version: number
  deck: BlackjackCard[]
  dealerCards: BlackjackCard[]
  playerHands: BlackjackHandState[]
  currentHandIndex: number
  stake: number
  chipBalanceBefore: number
  chipBalanceAfter: number
  insuranceBet: number
  insuranceOffered: boolean
  insuranceResolved: boolean
  idempotencyKey: string | null
  commandLog: Record<string, BlackjackCommandReplay>
  outcome: RoundOutcome | null
  delta: number
  totalStake: number
  summary: string
  resultSnapshot: Record<string, unknown> | null
  finalRoundId: string | null
  createdAt: string
  updatedAt: string
  expiresAt: string
}

export interface BlackjackHandView {
  handId: string
  cards: BlackjackVisibleCard[]
  total: number
  soft: boolean
  bet: number
  status: BlackjackHandStatus
  fromSplit: boolean
  doubled: boolean
  naturalBlackjack: boolean
  delta: number | null
  resultLabel: string | null
}

export interface BlackjackRoundView {
  roundId: string
  gameSlug: "blackjack"
  tableSessionId: string
  status: BlackjackRoundStatus
  phase: BlackjackPhase
  version: number
  dealer: {
    cards: BlackjackVisibleCard[]
    holeCardHidden: boolean
    total: number | null
  }
  playerHands: BlackjackHandView[]
  currentHandId: string | null
  allowedActions: BlackjackAction[]
  stake: number
  insuranceBet: number
  insuranceOffered: boolean
  totalCommittedStake: number
  chipBalanceBefore: number
  chipBalanceAfter: number
  delta: number
  summary: string
  round: RoundEnvelope | null
  serverTimestamp: string
  expiresAt: string
  idempotent: boolean
}

export interface BlackjackSettlement {
  outcome: RoundOutcome
  delta: number
  totalStake: number
  summary: string
  betSnapshot: Record<string, unknown>
  resultSnapshot: Record<string, unknown>
}

export interface CreateBlackjackRoundInput {
  roundId: string
  gameSlug: string
  tableSessionId: string
  stake: number
  chipBalanceBefore: number
  idempotencyKey?: string | null
  deck?: BlackjackCard[]
  nowIso?: string
}

export interface BlackjackCommandInput {
  commandId: string
  expectedVersion: number
  action: BlackjackAction
  handId?: string | null
}

export interface BlackjackCommandResult {
  state: BlackjackRoundState
  blackjackRound: BlackjackRoundView
  round: RoundEnvelope | null
  settlement: BlackjackSettlement | null
  idempotent: boolean
}

const suits: BlackjackSuit[] = ["spades", "hearts", "diamonds", "clubs"]
const ttlMs = 30 * 60 * 1000

export class BlackjackVersionConflictError extends Error {
  status = 409

  constructor(message = "Blackjack round version conflict.") {
    super(message)
    this.name = "BlackjackVersionConflictError"
  }
}

export class BlackjackCommandError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "BlackjackCommandError"
    this.status = status
  }
}

export function money(value: number) {
  return Math.round(value * 100) / 100
}

export function blackjackTtlExpiresAt(nowIso: string) {
  return new Date(new Date(nowIso).getTime() + ttlMs).toISOString()
}

export function isBlackjackExpired(state: Pick<BlackjackRoundState, "status" | "expiresAt">, nowIso = new Date().toISOString()) {
  return state.status === "active" && new Date(state.expiresAt).getTime() <= new Date(nowIso).getTime()
}

export function freshBlackjackDeck(rng: (max: number) => number = randomInt): BlackjackCard[] {
  const deck: BlackjackCard[] = []

  for (const suit of suits) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({ rank, suit })
    }
  }

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = rng(index + 1)
    const current = deck[index]
    deck[index] = deck[swapIndex]
    deck[swapIndex] = current
  }

  return deck
}

export function cardValue(card: BlackjackCard) {
  if (card.rank === 1) return 11
  return Math.min(card.rank, 10)
}

export function handTotal(cards: BlackjackCard[]) {
  let total = cards.reduce((sum, card) => sum + cardValue(card), 0)
  let aces = cards.filter((card) => card.rank === 1).length

  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }

  return total
}

export function isSoftHand(cards: BlackjackCard[]) {
  const hardTotal = cards.reduce((sum, card) => sum + (card.rank === 1 ? 1 : Math.min(card.rank, 10)), 0)
  return cards.some((card) => card.rank === 1) && hardTotal + 10 <= 21
}

function isNaturalBlackjack(cards: BlackjackCard[], fromSplit: boolean) {
  return !fromSplit && cards.length === 2 && handTotal(cards) === 21
}

function splitValue(card: BlackjackCard) {
  return card.rank === 1 ? 11 : Math.min(card.rank, 10)
}

function draw(deck: BlackjackCard[]) {
  const card = deck.shift()
  if (!card) {
    throw new BlackjackCommandError("The blackjack deck is exhausted.")
  }
  return card
}

function totalCommittedStake(state: Pick<BlackjackRoundState, "playerHands" | "insuranceBet">) {
  return money(state.playerHands.reduce((sum, hand) => sum + hand.bet, state.insuranceBet))
}

function makeHand(roundId: string, index: number, cards: BlackjackCard[], bet: number, fromSplit: boolean): BlackjackHandState {
  return {
    handId: `${roundId}-h${index + 1}`,
    cards,
    bet: money(bet),
    status: "active",
    fromSplit,
    doubled: false,
    naturalBlackjack: isNaturalBlackjack(cards, fromSplit),
    delta: null,
    resultLabel: null,
  }
}

export function createBlackjackRoundState(input: CreateBlackjackRoundInput): BlackjackRoundState {
  const nowIso = input.nowIso ?? new Date().toISOString()
  const stake = money(input.stake)
  const chipBalanceBefore = money(input.chipBalanceBefore)

  if (input.gameSlug !== "blackjack") {
    throw new BlackjackCommandError("Blackjack state can only be created for the blackjack table.")
  }

  if (stake <= 0) {
    throw new BlackjackCommandError("A valid blackjack stake is required.")
  }

  if (stake > chipBalanceBefore) {
    throw new BlackjackCommandError("Insufficient table chips for this blackjack stake.")
  }

  const deck = [...(input.deck ?? freshBlackjackDeck())]
  const playerFirst = draw(deck)
  const dealerFirst = draw(deck)
  const playerSecond = draw(deck)
  const dealerSecond = draw(deck)
  const dealerCards = [dealerFirst, dealerSecond]
  const playerHands = [makeHand(input.roundId, 0, [playerFirst, playerSecond], stake, false)]
  const insuranceOffered = dealerFirst.rank === 1

  return {
    roundId: input.roundId,
    gameSlug: "blackjack",
    tableSessionId: input.tableSessionId,
    status: "active",
    phase: insuranceOffered ? "insurance" : "player_turn",
    version: 1,
    deck,
    dealerCards,
    playerHands,
    currentHandIndex: 0,
    stake,
    chipBalanceBefore,
    chipBalanceAfter: chipBalanceBefore,
    insuranceBet: 0,
    insuranceOffered,
    insuranceResolved: !insuranceOffered,
    idempotencyKey: input.idempotencyKey ?? null,
    commandLog: {},
    outcome: null,
    delta: 0,
    totalStake: stake,
    summary: "",
    resultSnapshot: null,
    finalRoundId: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    expiresAt: blackjackTtlExpiresAt(nowIso),
  }
}

function currentHand(state: BlackjackRoundState) {
  return state.playerHands[state.currentHandIndex] ?? null
}

function allowedActions(state: BlackjackRoundState): BlackjackAction[] {
  if (state.status !== "active") return []

  if (state.phase === "insurance") {
    return ["buy_insurance", "skip_insurance"]
  }

  if (state.phase !== "player_turn") return []

  const hand = currentHand(state)
  if (!hand || hand.status !== "active") return []

  const total = handTotal(hand.cards)
  const actions: BlackjackAction[] = ["stand"]

  if (total < 21) {
    actions.unshift("hit")
  }

  if (hand.cards.length === 2 && total < 21 && totalCommittedStake(state) + hand.bet <= state.chipBalanceBefore) {
    actions.push("double")
  }

  if (
    hand.cards.length === 2 &&
    state.playerHands.length < 4 &&
    splitValue(hand.cards[0]) === splitValue(hand.cards[1]) &&
    totalCommittedStake(state) + hand.bet <= state.chipBalanceBefore
  ) {
    actions.push("split")
  }

  return actions
}

function publicHands(state: BlackjackRoundState): BlackjackHandView[] {
  return state.playerHands.map((hand) => ({
    handId: hand.handId,
    cards: hand.cards.map((card) => ({ ...card })),
    total: handTotal(hand.cards),
    soft: isSoftHand(hand.cards),
    bet: hand.bet,
    status: hand.status,
    fromSplit: hand.fromSplit,
    doubled: hand.doubled,
    naturalBlackjack: hand.naturalBlackjack,
    delta: hand.delta,
    resultLabel: hand.resultLabel,
  }))
}

function dealerView(state: BlackjackRoundState) {
  const reveal = state.status !== "active" || state.phase === "settled" || state.phase === "voided"
  const cards = reveal
    ? state.dealerCards.map((card) => ({ ...card }))
    : state.dealerCards.slice(0, 1).map((card) => ({ ...card }))

  return {
    cards,
    holeCardHidden: !reveal && state.dealerCards.length > 1,
    total: reveal ? handTotal(state.dealerCards) : null,
  }
}

function envelopeFromState(state: BlackjackRoundState, idempotent: boolean): RoundEnvelope | null {
  if (state.status !== "settled" || !state.outcome || !state.resultSnapshot) {
    return null
  }

  return {
    roundId: state.finalRoundId ?? state.roundId,
    gameSlug: "blackjack",
    tableSessionId: state.tableSessionId,
    status: "settled",
    version: 1,
    outcome: state.outcome,
    delta: state.delta,
    totalStake: state.totalStake,
    chipBalanceBefore: state.chipBalanceBefore,
    chipBalanceAvailable: state.chipBalanceAfter,
    chipBalanceAfter: state.chipBalanceAfter,
    summary: state.summary,
    betSnapshot: blackjackBetSnapshot(state),
    resultSnapshot: state.resultSnapshot,
    serverTimestamp: state.updatedAt,
    idempotent,
  }
}

export function publicBlackjackView(state: BlackjackRoundState, idempotent = false): BlackjackRoundView {
  const active = currentHand(state)
  const round = envelopeFromState(state, idempotent)

  return {
    roundId: state.roundId,
    gameSlug: "blackjack",
    tableSessionId: state.tableSessionId,
    status: state.status,
    phase: state.phase,
    version: state.version,
    dealer: dealerView(state),
    playerHands: publicHands(state),
    currentHandId: state.status === "active" && active ? active.handId : null,
    allowedActions: allowedActions(state),
    stake: state.stake,
    insuranceBet: state.insuranceBet,
    insuranceOffered: state.insuranceOffered,
    totalCommittedStake: totalCommittedStake(state),
    chipBalanceBefore: state.chipBalanceBefore,
    chipBalanceAfter: state.chipBalanceAfter,
    delta: state.delta,
    summary: state.summary,
    round,
    serverTimestamp: state.updatedAt,
    expiresAt: state.expiresAt,
    idempotent,
  }
}

function blackjackBetSnapshot(state: BlackjackRoundState) {
  return {
    stake: state.stake,
    insuranceBet: state.insuranceBet,
    totalStake: state.totalStake,
    hands: state.playerHands.map((hand) => ({
      handId: hand.handId,
      bet: hand.bet,
      doubled: hand.doubled,
      fromSplit: hand.fromSplit,
    })),
  }
}

function settlementFromState(state: BlackjackRoundState): BlackjackSettlement | null {
  if (state.status !== "settled" || !state.outcome || !state.resultSnapshot) return null

  return {
    outcome: state.outcome,
    delta: state.delta,
    totalStake: state.totalStake,
    summary: state.summary,
    betSnapshot: blackjackBetSnapshot(state),
    resultSnapshot: state.resultSnapshot,
  }
}

function resultForDelta(delta: number): RoundOutcome {
  return delta > 0 ? "win" : delta < 0 ? "loss" : "push"
}

function settleHandLabel(handDelta: number) {
  if (handDelta > 0) return `Won ${money(handDelta)}`
  if (handDelta < 0) return `Lost ${money(Math.abs(handDelta))}`
  return "Push"
}

function settleRound(state: BlackjackRoundState, nowIso: string): BlackjackRoundState {
  const next: BlackjackRoundState = {
    ...state,
    status: "settled",
    phase: "settled",
    updatedAt: nowIso,
    expiresAt: blackjackTtlExpiresAt(nowIso),
    finalRoundId: state.roundId,
    dealerCards: [...state.dealerCards],
    playerHands: state.playerHands.map((hand) => ({ ...hand, cards: [...hand.cards] })),
  }
  const allBusted = next.playerHands.every((hand) => handTotal(hand.cards) > 21)

  if (!allBusted) {
    while (handTotal(next.dealerCards) < 17) {
      next.dealerCards.push(draw(next.deck))
    }
  }

  const dealerTotal = handTotal(next.dealerCards)
  const dealerBlackjack = next.dealerCards.length === 2 && dealerTotal === 21
  let delta = dealerBlackjack && next.insuranceBet > 0 ? next.insuranceBet * 2 : -next.insuranceBet

  next.playerHands = next.playerHands.map((hand) => {
    const playerTotal = handTotal(hand.cards)
    const handDelta = playerTotal > 21 || (dealerBlackjack && !hand.naturalBlackjack)
      ? -hand.bet
      : hand.naturalBlackjack && !dealerBlackjack
        ? hand.bet * 1.5
        : dealerTotal > 21 || playerTotal > dealerTotal
          ? hand.bet
          : playerTotal < dealerTotal ? -hand.bet : 0

    delta += handDelta

    return {
      ...hand,
      status: "settled",
      delta: money(handDelta),
      resultLabel: settleHandLabel(handDelta),
    }
  })

  next.delta = money(delta)
  next.totalStake = totalCommittedStake(next)
  next.outcome = resultForDelta(next.delta)
  next.chipBalanceAfter = money(next.chipBalanceBefore + next.delta)
  next.summary = `Blackjack dealer ${dealerTotal}; ${next.delta >= 0 ? "+" : ""}${next.delta}`
  next.resultSnapshot = {
    dealerCards: next.dealerCards.map((card) => ({ ...card })),
    dealerTotal,
    dealerBlackjack,
    playerHands: next.playerHands.map((hand) => ({
      handId: hand.handId,
      cards: hand.cards.map((card) => ({ ...card })),
      total: handTotal(hand.cards),
      bet: hand.bet,
      doubled: hand.doubled,
      fromSplit: hand.fromSplit,
      naturalBlackjack: hand.naturalBlackjack,
      delta: hand.delta,
      resultLabel: hand.resultLabel,
    })),
    insuranceBet: next.insuranceBet,
    rng: "node:crypto.randomInt",
  }

  return next
}

function moveToNextHandOrSettle(state: BlackjackRoundState, nowIso: string): BlackjackRoundState {
  const nextIndex = state.playerHands.findIndex((hand, index) => index > state.currentHandIndex && hand.status === "active")

  if (nextIndex >= 0) {
    return {
      ...state,
      currentHandIndex: nextIndex,
      phase: "player_turn",
      updatedAt: nowIso,
      expiresAt: blackjackTtlExpiresAt(nowIso),
    }
  }

  return settleRound(state, nowIso)
}

function withCommandVersion(state: BlackjackRoundState, nowIso: string): BlackjackRoundState {
  return {
    ...state,
    version: state.version + 1,
    updatedAt: nowIso,
    expiresAt: blackjackTtlExpiresAt(nowIso),
    deck: [...state.deck],
    dealerCards: [...state.dealerCards],
    playerHands: state.playerHands.map((hand) => ({ ...hand, cards: [...hand.cards] })),
    commandLog: { ...state.commandLog },
  }
}

function storeReplay(state: BlackjackRoundState, input: BlackjackCommandInput, result: Omit<BlackjackCommandResult, "state">): BlackjackRoundState {
  return {
    ...state,
    commandLog: {
      ...state.commandLog,
      [input.commandId]: {
        commandId: input.commandId,
        expectedVersion: input.expectedVersion,
        action: input.action,
        handId: input.handId ?? null,
        blackjackRound: result.blackjackRound,
        round: result.round,
        settlement: result.settlement,
      },
    },
  }
}

function commandResult(state: BlackjackRoundState, idempotent: boolean): Omit<BlackjackCommandResult, "state"> {
  const blackjackRound = publicBlackjackView(state, idempotent)
  const round = envelopeFromState(state, idempotent)

  return {
    blackjackRound,
    round,
    settlement: settlementFromState(state),
    idempotent,
  }
}

export function applyBlackjackCommand(
  state: BlackjackRoundState,
  input: BlackjackCommandInput,
  nowIso = new Date().toISOString(),
): BlackjackCommandResult {
  const replay = state.commandLog[input.commandId]
  if (replay) {
    return {
      state,
      blackjackRound: { ...replay.blackjackRound, idempotent: true },
      round: replay.round ? { ...replay.round, idempotent: true } : null,
      settlement: replay.settlement,
      idempotent: true,
    }
  }

  if (state.status !== "active") {
    throw new BlackjackCommandError("Blackjack round is not active.", 409)
  }

  if (input.expectedVersion !== state.version) {
    throw new BlackjackVersionConflictError()
  }

  if (isBlackjackExpired(state, nowIso)) {
    throw new BlackjackCommandError("Blackjack round has expired.", 409)
  }

  let next = withCommandVersion(state, nowIso)

  if (next.phase === "insurance") {
    if (input.action !== "buy_insurance" && input.action !== "skip_insurance") {
      throw new BlackjackCommandError("Insurance decision is required before player actions.")
    }

    if (input.action === "buy_insurance") {
      const insuranceBet = money(next.stake / 2)
      if (totalCommittedStake(next) + insuranceBet > next.chipBalanceBefore) {
        throw new BlackjackCommandError("Insufficient table chips for insurance.")
      }
      next.insuranceBet = insuranceBet
    }

    next.insuranceResolved = true
    const dealerBlackjack = next.dealerCards.length === 2 && handTotal(next.dealerCards) === 21
    next = dealerBlackjack ? settleRound(next, nowIso) : { ...next, phase: "player_turn" }
  } else {
    if (next.phase !== "player_turn") {
      throw new BlackjackCommandError("Blackjack round is not waiting for a player action.")
    }

    const hand = currentHand(next)
    if (!hand || hand.status !== "active") {
      throw new BlackjackCommandError("Active blackjack hand was not found.")
    }

    if (input.handId && input.handId !== hand.handId) {
      throw new BlackjackCommandError("Blackjack command hand does not match the active hand.", 409)
    }

    const legalActions = allowedActions(next)
    if (!legalActions.includes(input.action)) {
      throw new BlackjackCommandError(`Blackjack action is not available: ${input.action}`)
    }

    if (input.action === "hit") {
      hand.cards.push(draw(next.deck))
      if (handTotal(hand.cards) >= 21) {
        hand.status = handTotal(hand.cards) > 21 ? "busted" : "standing"
        next = moveToNextHandOrSettle(next, nowIso)
      }
    }

    if (input.action === "stand") {
      hand.status = "standing"
      next = moveToNextHandOrSettle(next, nowIso)
    }

    if (input.action === "double") {
      hand.bet = money(hand.bet * 2)
      hand.doubled = true
      hand.cards.push(draw(next.deck))
      hand.status = handTotal(hand.cards) > 21 ? "busted" : "standing"
      next = moveToNextHandOrSettle(next, nowIso)
    }

    if (input.action === "split") {
      const [first, second] = hand.cards
      const firstHand = makeHand(next.roundId, next.playerHands.length, [first, draw(next.deck)], hand.bet, true)
      const secondHand = makeHand(next.roundId, next.playerHands.length + 1, [second, draw(next.deck)], hand.bet, true)
      next.playerHands.splice(next.currentHandIndex, 1, firstHand, secondHand)
      next.phase = "player_turn"
    }
  }

  next.totalStake = totalCommittedStake(next)
  const result = commandResult(next, false)
  next = storeReplay(next, input, result)

  return {
    state: next,
    ...result,
  }
}

export function voidExpiredBlackjackRound(
  state: BlackjackRoundState,
  nowIso = new Date().toISOString(),
): BlackjackRoundState {
  if (!isBlackjackExpired(state, nowIso)) {
    return state
  }

  return {
    ...state,
    status: "voided",
    phase: "voided",
    updatedAt: nowIso,
    chipBalanceAfter: state.chipBalanceBefore,
    delta: 0,
    summary: "Blackjack round expired and was voided without chip movement.",
  }
}

