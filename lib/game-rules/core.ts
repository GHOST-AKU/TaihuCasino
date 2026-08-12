import type {
  CanonicalBet,
  CanonicalBetSnapshot,
  RandomInt,
  SettlementOutcome,
} from "#game-rules/types"

export const MAX_BET_AMOUNT = 1_000_000
export const MAX_BET_ENTRIES = 100

export function money(value: number) {
  return Math.round(value * 100) / 100
}

export function settlementOutcome(delta: number): SettlementOutcome {
  return delta > 0 ? "win" : delta < 0 ? "loss" : "push"
}

export function randomIndex(rng: RandomInt, max: number) {
  const value = rng(max)

  if (!Number.isInteger(value) || value < 0 || value >= max) {
    throw new Error("The server random source returned an invalid value.")
  }

  return value
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function validAmount(value: unknown): value is number {
  return typeof value === "number"
    && Number.isFinite(value)
    && value > 0
    && value <= MAX_BET_AMOUNT
}

export function canonicalizeBets<const Key extends string>(
  ruleSet: string,
  rulesVersion: string,
  betSnapshot: Record<string, unknown>,
  allowedKeys: readonly Key[],
): CanonicalBetSnapshot<Key> {
  const allowed = new Set<string>(allowedKeys)
  const totals = new Map<Key, number>()
  const source = record(betSnapshot).bets

  const add = (rawKey: unknown, rawAmount: unknown) => {
    if (typeof rawKey !== "string" || !allowed.has(rawKey) || !validAmount(rawAmount)) return

    const key = rawKey as Key
    const next = money((totals.get(key) ?? 0) + rawAmount)
    if (next > MAX_BET_AMOUNT) {
      throw new Error(`The maximum bet per option is ${MAX_BET_AMOUNT}.`)
    }
    totals.set(key, next)
  }

  if (Array.isArray(source)) {
    if (source.length > MAX_BET_ENTRIES) {
      throw new Error(`A round may contain at most ${MAX_BET_ENTRIES} bet entries.`)
    }
    for (const entry of source) {
      const bet = record(entry)
      add(bet.key, bet.amount)
    }
  } else {
    const ledger = record(source)
    for (const key of allowedKeys) add(key, ledger[key])
  }

  const bets = allowedKeys.flatMap((key): CanonicalBet<Key>[] => {
    const amount = totals.get(key)
    return amount === undefined ? [] : [{ key, amount }]
  })
  const totalStake = money(bets.reduce((sum, bet) => sum + bet.amount, 0))

  if (totalStake <= 0) {
    throw new Error("At least one valid bet is required.")
  }

  return { ruleSet, rulesVersion, bets, totalStake }
}

export function settleFixedOdds<const Key extends string>(
  bets: readonly CanonicalBet<Key>[],
  wins: Readonly<Record<Key, boolean>>,
  netOdds: Readonly<Record<Key, number>>,
) {
  return money(bets.reduce((delta, bet) => (
    delta + (wins[bet.key] ? bet.amount * netOdds[bet.key] : -bet.amount)
  ), 0))
}
