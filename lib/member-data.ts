import "server-only"

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { cookies } from "next/headers"
import type { NextResponse } from "next/server"

import type { MemberSession } from "@/lib/member-session"
import {
  MEMBER_SESSION_COOKIE,
  createSessionFromSupabaseUser,
  createSupabaseAuthClient,
  createSupabaseServiceClient,
  getSessionSecret,
  isSupabaseAuthConfigured,
  readSessionToken,
} from "@/lib/server-auth"
import { getPlayableTable } from "@/lib/game-catalog"
import { createStubCreditIdempotencyKey, requireStubCreditingEnabled } from "@/lib/stub-crediting"
import { settleAuthoritativeRound } from "@/lib/authoritative-settlement"

type CookieStore = Awaited<ReturnType<typeof cookies>>

export type MemberTheme = "light" | "dark" | "system"
export type MemberLanguage = "zh" | "en"
export type ProfileVisibility = "private" | "friends" | "public"
export type ProgressOutcome = "win" | "loss" | "push"
export type WalletLedgerSource =
  | "game_round"
  | "ad_reward"
  | "purchase"
  | "admin_adjustment"
  | "system"
  | "table_buy_in"
  | "table_cash_out"
export type GameRoundStatus = "settled" | "rejected" | "voided"
export type TableSessionStatus = "active" | "cashed_out" | "abandoned"
export type AdRewardPlacement = "daily_bonus" | "loss_recovery" | "lobby_reward"
export type AdRewardStatus = "started" | "completed" | "credited" | "failed"
export type PurchaseStatus = "created" | "succeeded" | "failed" | "canceled" | "credited"

export interface MemberProfile {
  id: string
  account: string
  displayName: string
  avatarUrl: string
  provider: MemberSession["provider"]
  tier: string
  loginAt: string
  createdAt: string
  updatedAt: string
}

export interface MemberSettings {
  theme: MemberTheme
  language: MemberLanguage
  soundEnabled: boolean
  notificationEnabled: boolean
  marketingOptIn: boolean
  profileVisibility: ProfileVisibility
  quickBetAmount: number
  tableDensity: "comfortable" | "compact"
  responsibleLimit: number
}

export interface MemberWallet {
  currency: "USD"
  balance: number
  bonusBalance: number
  updatedAt: string
}

export interface MemberGameProgress {
  gameSlug: string
  plays: number
  wins: number
  losses: number
  streak: number
  bestStreak: number
  bankroll: number
  lastResult: ProgressOutcome | null
  lastDelta: number
  lastSummary: string
  lastPlayedAt: string | null
}

export interface MemberEvent {
  id: string
  kind: string
  title: string
  detail: string
  createdAt: string
}

export interface MemberWalletLedgerEntry {
  id: string
  source: WalletLedgerSource
  amount: number
  balanceBefore: number
  balanceAfter: number
  currency: "USD"
  referenceId: string | null
  idempotencyKey: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface MemberGameRound {
  id: string
  gameSlug: string
  tableSessionId: string | null
  roundStatus: GameRoundStatus
  totalStake: number
  delta: number
  outcome: ProgressOutcome
  chipBalanceBefore: number | null
  chipBalanceAfter: number | null
  resultSummary: string
  betSnapshot: Record<string, unknown>
  resultSnapshot: Record<string, unknown>
  idempotencyKey: string | null
  createdAt: string
}

export interface MemberTableSession {
  id: string
  gameSlug: string
  status: TableSessionStatus
  buyInAmount: number
  chipBalance: number
  walletLedgerId: string | null
  cashOutLedgerId: string | null
  idempotencyKey: string | null
  metadata: Record<string, unknown>
  openedAt: string
  closedAt: string | null
  updatedAt: string
}

export interface TableSessionMutationResult {
  tableSession: MemberTableSession
  walletEntry: WalletEntryResult | null
  wallet: MemberWallet | null
  idempotent: boolean
}

export interface MemberAdReward {
  id: string
  placement: AdRewardPlacement
  rewardAmount: number
  status: AdRewardStatus
  createdAt: string
  creditedAt: string | null
}

export interface MemberPurchase {
  id: string
  productId: string
  amount: number
  credits: number
  status: PurchaseStatus
  provider: string
  providerReference: string | null
  createdAt: string
  creditedAt: string | null
}

export interface MemberProduct {
  id: string
  title: string
  titleZh: string
  amount: number
  credits: number
  badge: string
}

export interface WalletEntryInput {
  source: WalletLedgerSource
  amount: number
  referenceId?: string | null
  idempotencyKey?: string | null
  metadata?: Record<string, unknown>
}

export interface WalletEntryResult {
  ledgerId: string
  balanceBefore: number
  balanceAfter: number
  amount: number
  currency: "USD"
  idempotent: boolean
  createdAt: string
}

export interface MemberOverview {
  session: MemberSession
  profile: MemberProfile
  settings: MemberSettings
  wallet: MemberWallet
  progress: MemberGameProgress[]
  recentEvents: MemberEvent[]
  walletLedger: MemberWalletLedgerEntry[]
  gameRounds: MemberGameRound[]
  adRewards: MemberAdReward[]
  purchases: MemberPurchase[]
}

interface AuthenticatedMember {
  session: MemberSession
  source: "supabase" | "local"
  supabase?: SupabaseClient
}

interface LocalMemberState {
  profile?: Partial<MemberProfile>
  settings?: Partial<MemberSettings>
  wallet?: Partial<MemberWallet>
  progress?: MemberGameProgress[]
  recentEvents?: MemberEvent[]
  walletLedger?: MemberWalletLedgerEntry[]
  gameRounds?: MemberGameRound[]
  adRewards?: MemberAdReward[]
  purchases?: MemberPurchase[]
  tableSessions?: MemberTableSession[]
}

export const MEMBER_STATE_COOKIE = "taihu-member-state"
const MEMBER_STATE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const LOCAL_STATE_PROGRESS_LIMIT = 4
const LOCAL_STATE_EVENT_LIMIT = 3
const LOCAL_STATE_ROUND_LIMIT = 12
const LOCAL_STATE_TABLE_SESSION_LIMIT = 8
const MEMBER_EVENT_KINDS = new Set([
  "login_success",
  "session_recovered",
  "game_start",
  "round_complete",
  "wallet_update",
  "ad_reward_start",
  "ad_reward_complete",
  "purchase_attempt",
  "purchase_success",
  "purchase_failed",
  "save_recovered",
])
const MEMBER_PRODUCTS: MemberProduct[] = [
  {
    id: "starter_credits",
    title: "Starter Credits",
    titleZh: "入门筹码包",
    amount: 1.99,
    credits: 1200,
    badge: "Starter",
  },
  {
    id: "table_night",
    title: "Table Night Pack",
    titleZh: "牌桌夜场包",
    amount: 4.99,
    credits: 3600,
    badge: "Popular",
  },
  {
    id: "resort_weekend",
    title: "Resort Weekend Pack",
    titleZh: "度假周末包",
    amount: 9.99,
    credits: 8200,
    badge: "Best value",
  },
]
const LOCAL_STATE_SUMMARY_LIMIT = 120

function nowIso() {
  return new Date().toISOString()
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url")
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url")
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function createStateToken(state: LocalMemberState) {
  const encodedPayload = base64UrlEncode(JSON.stringify(state))

  return `${encodedPayload}.${sign(encodedPayload)}`
}

function readStateToken(token: string | undefined): LocalMemberState {
  if (!token) {
    return {}
  }

  const [encodedPayload, signature] = token.split(".")

  if (!encodedPayload || !signature || !constantTimeEqual(signature, sign(encodedPayload))) {
    return {}
  }

  try {
    return JSON.parse(base64UrlDecode(encodedPayload)) as LocalMemberState
  } catch {
    return {}
  }
}

function writeLocalState(response: NextResponse, state: LocalMemberState) {
  response.cookies.set(MEMBER_STATE_COOKIE, createStateToken(state), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MEMBER_STATE_MAX_AGE_SECONDS,
  })
}

function compactLocalProgress(progress: MemberGameProgress[]) {
  return progress.slice(0, LOCAL_STATE_PROGRESS_LIMIT).map((item) => ({
    ...item,
    lastSummary: item.lastSummary.slice(0, LOCAL_STATE_SUMMARY_LIMIT),
  }))
}

function compactLocalEvents(events: MemberEvent[]) {
  return events.slice(0, LOCAL_STATE_EVENT_LIMIT).map((event) => ({
    ...event,
    title: event.title.slice(0, 80),
    detail: event.detail.slice(0, LOCAL_STATE_SUMMARY_LIMIT),
  }))
}

function compactLocalGameRounds(rounds: MemberGameRound[]) {
  return rounds.slice(0, LOCAL_STATE_ROUND_LIMIT).map((round) => ({
    ...round,
    resultSummary: round.resultSummary.slice(0, LOCAL_STATE_SUMMARY_LIMIT),
  }))
}

function compactLocalTableSessions(sessions: MemberTableSession[]) {
  return sessions.slice(0, LOCAL_STATE_TABLE_SESSION_LIMIT)
}

function defaultSettings(): MemberSettings {
  return {
    theme: "dark",
    language: "zh",
    soundEnabled: true,
    notificationEnabled: true,
    marketingOptIn: false,
    profileVisibility: "private",
    quickBetAmount: 100,
    tableDensity: "comfortable",
    responsibleLimit: 5000,
  }
}

function defaultWallet(): MemberWallet {
  return {
    currency: "USD",
    balance: 25000,
    bonusBalance: 1200,
    updatedAt: nowIso(),
  }
}

function defaultProfile(session: MemberSession): MemberProfile {
  const createdAt = session.loginAt || nowIso()

  return {
    id: session.userId ?? session.account,
    account: session.account,
    displayName: session.displayName,
    avatarUrl: "",
    provider: session.provider ?? "local",
    tier: session.provider === "supabase" ? "Verified Member" : "Test Member",
    loginAt: session.loginAt,
    createdAt,
    updatedAt: createdAt,
  }
}

function normalizeDisplayName(value: unknown) {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim().slice(0, 60)

  return trimmed.length >= 2 ? trimmed : undefined
}

function normalizeAvatarUrl(value: unknown) {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return ""
  }

  try {
    const url = new URL(trimmed)

    if (url.protocol === "https:") {
      return url.toString()
    }
  } catch {
    return undefined
  }

  return undefined
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value)

  if (!Number.isFinite(numeric)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.round(numeric)))
}

function normalizeMoney(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value)

  return Number.isFinite(numeric) ? numeric : fallback
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function formatSupabaseError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message
  }

  return "unknown error"
}

function mergeSettings(settings?: Partial<MemberSettings>): MemberSettings {
  const defaults = defaultSettings()

  return {
    ...defaults,
    ...settings,
    theme: settings?.theme === "light" || settings?.theme === "system" ? settings.theme : settings?.theme === "dark" ? "dark" : defaults.theme,
    language: settings?.language === "en" ? "en" : settings?.language === "zh" ? "zh" : defaults.language,
    profileVisibility:
      settings?.profileVisibility === "friends" || settings?.profileVisibility === "public"
        ? settings.profileVisibility
        : settings?.profileVisibility === "private"
          ? "private"
          : defaults.profileVisibility,
    tableDensity: settings?.tableDensity === "compact" ? "compact" : "comfortable",
    quickBetAmount: normalizeNumber(settings?.quickBetAmount, defaults.quickBetAmount, 10, 5000),
    responsibleLimit: normalizeNumber(settings?.responsibleLimit, defaults.responsibleLimit, 100, 100000),
    soundEnabled: typeof settings?.soundEnabled === "boolean" ? settings.soundEnabled : defaults.soundEnabled,
    notificationEnabled:
      typeof settings?.notificationEnabled === "boolean" ? settings.notificationEnabled : defaults.notificationEnabled,
    marketingOptIn: typeof settings?.marketingOptIn === "boolean" ? settings.marketingOptIn : defaults.marketingOptIn,
  }
}

function toProfile(session: MemberSession, row?: Record<string, unknown> | null): MemberProfile {
  const fallback = defaultProfile(session)

  return {
    ...fallback,
    id: typeof row?.id === "string" ? row.id : fallback.id,
    displayName: typeof row?.display_name === "string" && row.display_name ? row.display_name : fallback.displayName,
    avatarUrl: typeof row?.avatar_url === "string" ? row.avatar_url : fallback.avatarUrl,
    createdAt: typeof row?.created_at === "string" ? row.created_at : fallback.createdAt,
    updatedAt: typeof row?.updated_at === "string" ? row.updated_at : fallback.updatedAt,
  }
}

function toSettings(row?: Record<string, unknown> | null): MemberSettings {
  return mergeSettings({
    theme: row?.theme as MemberTheme | undefined,
    language: row?.language as MemberLanguage | undefined,
    soundEnabled: row?.sound_enabled as boolean | undefined,
    notificationEnabled: row?.notification_enabled as boolean | undefined,
    marketingOptIn: row?.marketing_opt_in as boolean | undefined,
    profileVisibility: row?.profile_visibility as ProfileVisibility | undefined,
    quickBetAmount: row?.quick_bet_amount as number | undefined,
    tableDensity: row?.table_density as "comfortable" | "compact" | undefined,
    responsibleLimit: row?.responsible_limit as number | undefined,
  })
}

function toWallet(row?: Record<string, unknown> | null): MemberWallet {
  const fallback = defaultWallet()

  return {
    currency: "USD",
    balance: normalizeMoney(row?.balance, fallback.balance),
    bonusBalance: normalizeMoney(row?.bonus_balance, fallback.bonusBalance),
    updatedAt: typeof row?.updated_at === "string" ? row.updated_at : fallback.updatedAt,
  }
}

function toProgress(row: Record<string, unknown>): MemberGameProgress {
  return {
    gameSlug: String(row.game_slug ?? ""),
    plays: Number(row.plays ?? 0),
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
    streak: Number(row.streak ?? 0),
    bestStreak: Number(row.best_streak ?? 0),
    bankroll: Number(row.bankroll ?? 25000),
    lastResult:
      row.last_result === "win" || row.last_result === "loss" || row.last_result === "push"
        ? row.last_result
        : null,
    lastDelta: Number(row.last_delta ?? 0),
    lastSummary: typeof row.last_summary === "string" ? row.last_summary : "",
    lastPlayedAt: typeof row.last_played_at === "string" ? row.last_played_at : null,
  }
}

function toEvent(row: Record<string, unknown>): MemberEvent {
  return {
    id: String(row.id ?? `${Date.now()}`),
    kind: typeof row.kind === "string" ? row.kind : "system",
    title: typeof row.title === "string" ? row.title : "Member event",
    detail: typeof row.detail === "string" ? row.detail : "",
    createdAt: typeof row.created_at === "string" ? row.created_at : nowIso(),
  }
}

function toWalletLedgerEntry(row: Record<string, unknown>): MemberWalletLedgerEntry {
  const source =
    row.source === "game_round" ||
    row.source === "ad_reward" ||
    row.source === "purchase" ||
    row.source === "admin_adjustment" ||
    row.source === "system" ||
    row.source === "table_buy_in" ||
    row.source === "table_cash_out"
      ? row.source
      : "system"

  return {
    id: String(row.id ?? `${Date.now()}`),
    source,
    amount: normalizeMoney(row.amount),
    balanceBefore: normalizeMoney(row.balance_before),
    balanceAfter: normalizeMoney(row.balance_after),
    currency: "USD",
    referenceId: typeof row.reference_id === "string" ? row.reference_id : null,
    idempotencyKey: typeof row.idempotency_key === "string" ? row.idempotency_key : null,
    metadata: normalizeRecord(row.metadata),
    createdAt: typeof row.created_at === "string" ? row.created_at : nowIso(),
  }
}

function toGameRound(row: Record<string, unknown>): MemberGameRound {
  const roundStatus =
    row.round_status === "rejected" || row.round_status === "voided" ? row.round_status : "settled"
  const outcome =
    row.outcome === "win" || row.outcome === "loss" || row.outcome === "push" ? row.outcome : "push"

  return {
    id: String(row.id ?? `${Date.now()}`),
    gameSlug: String(row.game_slug ?? ""),
    tableSessionId: typeof row.table_session_id === "string" ? row.table_session_id : null,
    roundStatus,
    totalStake: normalizeMoney(row.total_stake),
    delta: normalizeMoney(row.delta),
    outcome,
    chipBalanceBefore: row.chip_balance_before === null || row.chip_balance_before === undefined ? null : normalizeMoney(row.chip_balance_before),
    chipBalanceAfter: row.chip_balance_after === null || row.chip_balance_after === undefined ? null : normalizeMoney(row.chip_balance_after),
    resultSummary: typeof row.result_summary === "string" ? row.result_summary : "",
    betSnapshot: normalizeRecord(row.bet_snapshot),
    resultSnapshot: normalizeRecord(row.result_snapshot),
    idempotencyKey: typeof row.idempotency_key === "string" ? row.idempotency_key : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : nowIso(),
  }
}

function toTableSession(row: Record<string, unknown>): MemberTableSession {
  const status =
    row.status === "cashed_out" || row.status === "abandoned" ? row.status : "active"

  return {
    id: String(row.id ?? `${Date.now()}`),
    gameSlug: String(row.game_slug ?? ""),
    status,
    buyInAmount: normalizeMoney(row.buy_in_amount),
    chipBalance: normalizeMoney(row.chip_balance),
    walletLedgerId: typeof row.wallet_ledger_id === "string" ? row.wallet_ledger_id : null,
    cashOutLedgerId: typeof row.cash_out_ledger_id === "string" ? row.cash_out_ledger_id : null,
    idempotencyKey: typeof row.idempotency_key === "string" ? row.idempotency_key : null,
    metadata: normalizeRecord(row.metadata),
    openedAt: typeof row.opened_at === "string" ? row.opened_at : nowIso(),
    closedAt: typeof row.closed_at === "string" ? row.closed_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : nowIso(),
  }
}

function toAdReward(row: Record<string, unknown>): MemberAdReward {
  const placement =
    row.placement === "loss_recovery" || row.placement === "lobby_reward" ? row.placement : "daily_bonus"
  const status =
    row.status === "started" || row.status === "completed" || row.status === "credited" || row.status === "failed"
      ? row.status
      : "started"

  return {
    id: String(row.id ?? `${Date.now()}`),
    placement,
    rewardAmount: normalizeMoney(row.reward_amount),
    status,
    createdAt: typeof row.created_at === "string" ? row.created_at : nowIso(),
    creditedAt: typeof row.credited_at === "string" ? row.credited_at : null,
  }
}

function toPurchase(row: Record<string, unknown>): MemberPurchase {
  const status =
    row.status === "succeeded" ||
    row.status === "failed" ||
    row.status === "canceled" ||
    row.status === "credited"
      ? row.status
      : "created"

  return {
    id: String(row.id ?? `${Date.now()}`),
    productId: typeof row.product_id === "string" ? row.product_id : "",
    amount: normalizeMoney(row.amount),
    credits: normalizeMoney(row.credits),
    status,
    provider: typeof row.provider === "string" ? row.provider : "stub",
    providerReference: typeof row.provider_reference === "string" ? row.provider_reference : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : nowIso(),
    creditedAt: typeof row.credited_at === "string" ? row.credited_at : null,
  }
}

function toWalletEntryResult(row: Record<string, unknown>): WalletEntryResult {
  return {
    ledgerId: String(row.ledger_id ?? row.id ?? `${Date.now()}`),
    balanceBefore: normalizeMoney(row.balance_before),
    balanceAfter: normalizeMoney(row.balance_after),
    amount: normalizeMoney(row.amount),
    currency: "USD",
    idempotent: row.idempotent === true,
    createdAt: typeof row.created_at === "string" ? row.created_at : nowIso(),
  }
}

async function applySupabaseWalletEntry(auth: AuthenticatedMember, input: WalletEntryInput): Promise<WalletEntryResult> {
  if (!auth.session.userId) {
    throw new Error("Supabase member session is missing a user id.")
  }

  const serviceSupabase = createSupabaseServiceClient()
  const { data, error } = await serviceSupabase.rpc("apply_member_wallet_entry", {
    p_user_id: auth.session.userId,
    p_source: input.source,
    p_amount: input.amount,
    p_reference_id: input.referenceId ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
    p_metadata: input.metadata ?? {},
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Wallet service returned an invalid response.")
  }

  return toWalletEntryResult(data as Record<string, unknown>)
}

function applyLocalWalletEntry(
  auth: AuthenticatedMember,
  cookieStore: CookieStore,
  response: NextResponse,
  input: WalletEntryInput,
): WalletEntryResult {
  const state = readStateToken(cookieStore.get(MEMBER_STATE_COOKIE)?.value)
  const existingEntry =
    input.idempotencyKey && state.walletLedger
      ? state.walletLedger.find((entry) => entry.idempotencyKey === input.idempotencyKey)
      : undefined

  if (existingEntry) {
    return {
      ledgerId: existingEntry.id,
      balanceBefore: existingEntry.balanceBefore,
      balanceAfter: existingEntry.balanceAfter,
      amount: existingEntry.amount,
      currency: existingEntry.currency,
      idempotent: true,
      createdAt: existingEntry.createdAt,
    }
  }

  const currentWallet = {
    ...defaultWallet(),
    ...state.wallet,
    currency: "USD" as const,
  }
  const amount = normalizeMoney(input.amount)
  const balanceBefore = currentWallet.balance
  const balanceAfter = Math.round((balanceBefore + amount) * 100) / 100

  if (balanceAfter < 0) {
    throw new Error("Insufficient wallet balance.")
  }

  const createdAt = nowIso()
  const ledgerEntry: MemberWalletLedgerEntry = {
    id: `${createdAt}-${Math.random().toString(16).slice(2)}`,
    source: input.source,
    amount,
    balanceBefore,
    balanceAfter,
    currency: "USD",
    referenceId: input.referenceId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    metadata: {
      ...(input.metadata ?? {}),
      sessionProvider: auth.session.provider ?? "local",
    },
    createdAt,
  }

  writeLocalState(response, {
    ...state,
    wallet: {
      ...currentWallet,
      balance: balanceAfter,
      updatedAt: createdAt,
    },
    walletLedger: [ledgerEntry, ...(state.walletLedger ?? [])].slice(0, 12),
  })

  return {
    ledgerId: ledgerEntry.id,
    balanceBefore,
    balanceAfter,
    amount,
    currency: "USD",
    idempotent: false,
    createdAt,
  }
}

async function applyAuthenticatedWalletEntry(
  auth: AuthenticatedMember,
  cookieStore: CookieStore,
  response: NextResponse,
  input: WalletEntryInput,
) {
  if (auth.source === "supabase") {
    return applySupabaseWalletEntry(auth, input)
  }

  return applyLocalWalletEntry(auth, cookieStore, response, input)
}

export async function applyWalletEntry(cookieStore: CookieStore, response: NextResponse, input: WalletEntryInput) {
  const auth = await getAuthenticatedMember(cookieStore, response)

  if (!auth) {
    return null
  }

  return applyAuthenticatedWalletEntry(auth, cookieStore, response, input)
}

export async function readWallet(cookieStore: CookieStore, response?: NextResponse) {
  const overview = await readMemberOverview(cookieStore, response)

  return overview?.wallet ?? null
}

export async function readWalletLedger(cookieStore: CookieStore, limit = 12, response?: NextResponse) {
  const overview = await readMemberOverview(cookieStore, response)

  return overview ? overview.walletLedger.slice(0, Math.max(1, Math.min(50, limit))) : null
}

async function readAuthenticatedWallet(auth: AuthenticatedMember): Promise<MemberWallet> {
  if (auth.source === "supabase") {
    if (!auth.supabase || !auth.session.userId) {
      throw new Error("Supabase member session is missing a user id.")
    }

    const { data, error } = await auth.supabase
      .from("member_wallets")
      .select("*")
      .eq("user_id", auth.session.userId)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    return toWallet(data)
  }

  const state = readStateToken(undefined)
  return {
    ...defaultWallet(),
    ...state.wallet,
    currency: "USD",
  }
}

function normalizeGameSlug(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 80) : ""
}

function normalizeIdempotencyKey(value: unknown, fallbackPrefix: string) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 160)
    : `${fallbackPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toRpcWalletEntry(value: unknown): WalletEntryResult | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? toWalletEntryResult(value as Record<string, unknown>)
    : null
}

function toRpcTableSessionResult(value: unknown): {
  tableSession: MemberTableSession
  walletEntry: WalletEntryResult | null
  idempotent: boolean
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Table session service returned an invalid response.")
  }

  const payload = value as Record<string, unknown>
  const sessionPayload = payload.session

  if (!sessionPayload || typeof sessionPayload !== "object" || Array.isArray(sessionPayload)) {
    throw new Error("Table session service returned an invalid session.")
  }

  return {
    tableSession: toTableSession(sessionPayload as Record<string, unknown>),
    walletEntry: toRpcWalletEntry(payload.wallet_entry),
    idempotent: payload.idempotent === true,
  }
}

export async function readActiveTableSession(cookieStore: CookieStore, gameSlug: string, response?: NextResponse) {
  const auth = await getAuthenticatedMember(cookieStore, response)

  if (!auth) {
    return null
  }

  if (auth.source === "supabase") {
    if (!auth.supabase || !auth.session.userId) {
      throw new Error("Supabase member session is missing a user id.")
    }

    const { data, error } = await auth.supabase
      .from("member_table_sessions")
      .select("*")
      .eq("user_id", auth.session.userId)
      .eq("game_slug", gameSlug)
      .eq("status", "active")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    return data ? toTableSession(data) : null
  }

  const state = readStateToken(cookieStore.get(MEMBER_STATE_COOKIE)?.value)
  return (state.tableSessions ?? []).find((session) => session.gameSlug === gameSlug && session.status === "active") ?? null
}

export async function openTableSession(
  cookieStore: CookieStore,
  response: NextResponse,
  body: unknown,
): Promise<TableSessionMutationResult | null> {
  const auth = await getAuthenticatedMember(cookieStore, response)

  if (!auth) {
    return null
  }

  const patchBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const gameSlug = normalizeGameSlug(patchBody.gameSlug)
  const buyInAmount = Math.min(1000000, Math.max(1, normalizeMoney(patchBody.buyInAmount, 100)))
  const idempotencyKey = normalizeIdempotencyKey(patchBody.idempotencyKey, "table-session")

  if (!gameSlug) {
    throw new Error("Game slug is required.")
  }

  if (auth.source === "supabase") {
    if (!auth.session.userId) {
      throw new Error("Supabase member session is missing a user id.")
    }

    const serviceSupabase = createSupabaseServiceClient()
    const { data, error } = await serviceSupabase.rpc("open_member_table_session", {
      p_user_id: auth.session.userId,
      p_game_slug: gameSlug,
      p_buy_in_amount: buyInAmount,
      p_idempotency_key: idempotencyKey,
      p_metadata: normalizeRecord(patchBody.metadata),
    })

    if (error) {
      throw new Error(error.message)
    }

    const result = toRpcTableSessionResult(data)
    return {
      ...result,
      wallet: await readAuthenticatedWallet(auth),
    }
  }

  const state = readStateToken(cookieStore.get(MEMBER_STATE_COOKIE)?.value)
  const activeSession = (state.tableSessions ?? []).find((session) => session.gameSlug === gameSlug && session.status === "active")

  if (activeSession) {
    return {
      tableSession: activeSession,
      walletEntry: null,
      wallet: {
        ...defaultWallet(),
        ...state.wallet,
        currency: "USD",
      },
      idempotent: true,
    }
  }

  const sessionId = randomUUID()
  const walletEntry = applyLocalWalletEntry(auth, cookieStore, response, {
    source: "table_buy_in",
    amount: -buyInAmount,
    referenceId: sessionId,
    idempotencyKey: `table-buy-in:${idempotencyKey}`,
    metadata: { gameSlug, tableSessionId: sessionId },
  })
  const createdAt = walletEntry.createdAt
  const tableSession: MemberTableSession = {
    id: sessionId,
    gameSlug,
    status: "active",
    buyInAmount,
    chipBalance: buyInAmount,
    walletLedgerId: walletEntry.ledgerId,
    cashOutLedgerId: null,
    idempotencyKey,
    metadata: normalizeRecord(patchBody.metadata),
    openedAt: createdAt,
    closedAt: null,
    updatedAt: createdAt,
  }
  const nextWallet = {
    ...defaultWallet(),
    ...state.wallet,
    balance: walletEntry.balanceAfter,
    updatedAt: createdAt,
    currency: "USD" as const,
  }

  writeLocalState(response, {
    ...state,
    wallet: nextWallet,
    tableSessions: compactLocalTableSessions([tableSession, ...(state.tableSessions ?? [])]),
  })

  return {
    tableSession,
    walletEntry,
    wallet: nextWallet,
    idempotent: false,
  }
}

export async function cashOutTableSession(
  cookieStore: CookieStore,
  response: NextResponse,
  sessionId: string,
  body: unknown,
): Promise<TableSessionMutationResult | null> {
  const auth = await getAuthenticatedMember(cookieStore, response)

  if (!auth) {
    return null
  }

  const patchBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const idempotencyKey = normalizeIdempotencyKey(patchBody.idempotencyKey, `table-cash-out-${sessionId}`)

  if (auth.source === "supabase") {
    if (!auth.session.userId) {
      throw new Error("Supabase member session is missing a user id.")
    }

    const serviceSupabase = createSupabaseServiceClient()
    const { data, error } = await serviceSupabase.rpc("cash_out_member_table_session", {
      p_user_id: auth.session.userId,
      p_session_id: sessionId,
      p_idempotency_key: idempotencyKey,
    })

    if (error) {
      throw new Error(error.message)
    }

    const result = toRpcTableSessionResult(data)
    return {
      ...result,
      wallet: await readAuthenticatedWallet(auth),
    }
  }

  const state = readStateToken(cookieStore.get(MEMBER_STATE_COOKIE)?.value)
  const sessions = [...(state.tableSessions ?? [])]
  const sessionIndex = sessions.findIndex((session) => session.id === sessionId)
  const tableSession = sessionIndex >= 0 ? sessions[sessionIndex] : null

  if (!tableSession) {
    throw new Error("Table session was not found.")
  }

  if (tableSession.status !== "active") {
    return {
      tableSession,
      walletEntry: null,
      wallet: {
        ...defaultWallet(),
        ...state.wallet,
        currency: "USD",
      },
      idempotent: true,
    }
  }

  const walletEntry = applyLocalWalletEntry(auth, cookieStore, response, {
    source: "table_cash_out",
    amount: tableSession.chipBalance,
    referenceId: tableSession.id,
    idempotencyKey,
    metadata: { gameSlug: tableSession.gameSlug, tableSessionId: tableSession.id },
  })
  const closedAt = walletEntry.createdAt
  const nextSession: MemberTableSession = {
    ...tableSession,
    status: "cashed_out",
    chipBalance: 0,
    cashOutLedgerId: walletEntry.ledgerId,
    closedAt,
    updatedAt: closedAt,
  }
  sessions[sessionIndex] = nextSession
  const nextWallet = {
    ...defaultWallet(),
    ...state.wallet,
    balance: walletEntry.balanceAfter,
    updatedAt: closedAt,
    currency: "USD" as const,
  }

  writeLocalState(response, {
    ...state,
    wallet: nextWallet,
    tableSessions: compactLocalTableSessions(sessions),
  })

  return {
    tableSession: nextSession,
    walletEntry,
    wallet: nextWallet,
    idempotent: false,
  }
}

async function settleSupabaseTableSessionRound(
  auth: AuthenticatedMember,
  {
    sessionId,
    gameSlug,
    outcome,
    delta,
    totalStake,
    summary,
    betSnapshot,
    resultSnapshot,
    idempotencyKey,
  }: {
    sessionId: string
    gameSlug: string
    outcome: ProgressOutcome
    delta: number
    totalStake: number
    summary: string
    betSnapshot: Record<string, unknown>
    resultSnapshot: Record<string, unknown>
    idempotencyKey: string | null
  },
) {
  if (!auth.session.userId) {
    throw new Error("Supabase member session is missing a user id.")
  }

  const serviceSupabase = createSupabaseServiceClient()
  const { data: activeSession, error: activeSessionError } = await serviceSupabase
    .from("member_table_sessions")
    .select("game_slug, chip_balance")
    .eq("id", sessionId)
    .eq("user_id", auth.session.userId)
    .eq("status", "active")
    .maybeSingle()

  if (activeSessionError) {
    throw new Error(activeSessionError.message)
  }

  if (!activeSession) {
    throw new Error("Active table session was not found.")
  }

  if (activeSession.game_slug !== gameSlug) {
    throw new Error("Table session game does not match round game.")
  }

  if (totalStake > normalizeMoney(activeSession.chip_balance)) {
    throw new Error("Insufficient table chips for this stake.")
  }

  const { data, error } = await serviceSupabase.rpc("settle_member_table_session_round", {
    p_user_id: auth.session.userId,
    p_session_id: sessionId,
    p_game_slug: gameSlug,
    p_outcome: outcome,
    p_delta: delta,
    p_total_stake: totalStake,
    p_summary: summary,
    p_bet_snapshot: betSnapshot,
    p_result_snapshot: resultSnapshot,
    p_idempotency_key: idempotencyKey,
  })

  if (error) {
    if (error.message.includes("settle_member_table_session_round") || error.message.includes("schema cache")) {
      return settleSupabaseTableSessionRoundDirect(auth, {
        sessionId,
        gameSlug,
        outcome,
        delta,
        totalStake,
        summary,
        betSnapshot,
        resultSnapshot,
        idempotencyKey,
      })
    }

    throw new Error(error.message)
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Table round service returned an invalid response.")
  }

  const payload = data as Record<string, unknown>
  const progressPayload = payload.progress
  const sessionPayload = payload.session

  if (!progressPayload || typeof progressPayload !== "object" || Array.isArray(progressPayload)) {
    throw new Error("Table round service returned an invalid progress record.")
  }

  if (!sessionPayload || typeof sessionPayload !== "object" || Array.isArray(sessionPayload)) {
    throw new Error("Table round service returned an invalid table session.")
  }

  return {
    progress: toProgress(progressPayload as Record<string, unknown>),
    tableSession: toTableSession(sessionPayload as Record<string, unknown>),
    idempotent: payload.idempotent === true,
  }
}

async function settleSupabaseTableSessionRoundDirect(
  auth: AuthenticatedMember,
  {
    sessionId,
    gameSlug,
    outcome,
    delta,
    totalStake,
    summary,
    betSnapshot,
    resultSnapshot,
    idempotencyKey,
  }: {
    sessionId: string
    gameSlug: string
    outcome: ProgressOutcome
    delta: number
    totalStake: number
    summary: string
    betSnapshot: Record<string, unknown>
    resultSnapshot: Record<string, unknown>
    idempotencyKey: string | null
  },
) {
  const userId = auth.session.userId

  if (!userId) {
    throw new Error("Supabase member session is missing a user id.")
  }

  const serviceSupabase = createSupabaseServiceClient()

  if (idempotencyKey) {
    const existingRound = await findSupabaseRoundByIdempotencyKey(userId, idempotencyKey)

    if (existingRound) {
      const [{ data: existingSession }, { data: existingProgress }] = await Promise.all([
        serviceSupabase
          .from("member_table_sessions")
          .select("*")
          .eq("id", existingRound.tableSessionId ?? sessionId)
          .eq("user_id", userId)
          .maybeSingle(),
        serviceSupabase
          .from("member_game_progress")
          .select("*")
          .eq("user_id", userId)
          .eq("game_slug", existingRound.gameSlug)
          .maybeSingle(),
      ])

      if (existingSession && existingProgress) {
        return {
          progress: toProgress(existingProgress),
          tableSession: toTableSession(existingSession),
          idempotent: true,
        }
      }
    }
  }

  const { data: sessionData, error: sessionError } = await serviceSupabase
    .from("member_table_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  if (sessionError) {
    throw new Error(sessionError.message)
  }

  if (!sessionData) {
    throw new Error("Active table session was not found.")
  }

  const tableSession = toTableSession(sessionData)

  if (tableSession.gameSlug !== gameSlug) {
    throw new Error("Table session game does not match round game.")
  }

  const chipBalanceBefore = tableSession.chipBalance

  if (totalStake > chipBalanceBefore) {
    throw new Error("Insufficient table chips for this stake.")
  }

  const chipBalanceAfter = Math.round((chipBalanceBefore + delta) * 100) / 100

  if (chipBalanceAfter < 0) {
    throw new Error("Insufficient table chips.")
  }

  const playedAt = nowIso()
  const { data: updatedSession, error: updateSessionError } = await serviceSupabase
    .from("member_table_sessions")
    .update({
      chip_balance: chipBalanceAfter,
      updated_at: playedAt,
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("status", "active")
    .select("*")
    .single()

  if (updateSessionError) {
    throw new Error(updateSessionError.message)
  }

  const { data: existingProgress, error: existingProgressError } = await serviceSupabase
    .from("member_game_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("game_slug", gameSlug)
    .maybeSingle()

  if (existingProgressError) {
    throw new Error(existingProgressError.message)
  }

  const current = existingProgress ? toProgress(existingProgress) : null
  const streak = outcome === "win" ? (current?.streak ?? 0) + 1 : outcome === "loss" ? 0 : current?.streak ?? 0
  const { data: progressData, error: progressError } = await serviceSupabase
    .from("member_game_progress")
    .upsert({
      user_id: userId,
      game_slug: gameSlug,
      plays: (current?.plays ?? 0) + 1,
      wins: (current?.wins ?? 0) + (outcome === "win" ? 1 : 0),
      losses: (current?.losses ?? 0) + (outcome === "loss" ? 1 : 0),
      streak,
      best_streak: Math.max(current?.bestStreak ?? 0, streak),
      bankroll: chipBalanceAfter,
      last_result: outcome,
      last_delta: delta,
      last_summary: summary,
      last_played_at: playedAt,
    })
    .select("*")
    .single()

  if (progressError) {
    throw new Error(progressError.message)
  }

  await insertSupabaseGameRound({
    userId,
    gameSlug,
    tableSessionId: sessionId,
    outcome,
    delta,
    totalStake,
    chipBalanceBefore,
    chipBalanceAfter,
    summary,
    betSnapshot,
    resultSnapshot: {
      ...resultSnapshot,
      tableSessionId: sessionId,
      chipBalanceBefore,
      chipBalanceAfter,
    },
    idempotencyKey,
  })

  const { error: eventError } = await serviceSupabase.from("member_events").insert({
    user_id: userId,
    kind: "round_complete",
    title: `${gameSlug} ${outcome}`,
    detail: summary,
  })

  if (eventError) {
    throw new Error(eventError.message)
  }

  return {
    progress: toProgress(progressData),
    tableSession: toTableSession(updatedSession),
    idempotent: false,
  }
}

export async function getAuthenticatedMember(
  cookieStore: CookieStore,
  response?: NextResponse,
): Promise<AuthenticatedMember | null> {
  if (isSupabaseAuthConfigured()) {
    const supabase = createSupabaseAuthClient(cookieStore, response)
    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
      return null
    }

    return {
      session: createSessionFromSupabaseUser(data.user),
      source: "supabase",
      supabase,
    }
  }

  const token = cookieStore.get(MEMBER_SESSION_COOKIE)?.value
  const session = readSessionToken(token)

  return session
    ? {
        session,
        source: "local",
      }
    : null
}

async function readSupabaseOverview(auth: AuthenticatedMember): Promise<MemberOverview> {
  const supabase = auth.supabase
  const userId = auth.session.userId

  if (!supabase || !userId) {
    throw new Error("Supabase member session is missing a user id.")
  }

  const [
    profileResult,
    settingsResult,
    walletResult,
    progressResult,
    eventResult,
    ledgerResult,
    roundResult,
    adRewardResult,
    purchaseResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url, created_at, updated_at").eq("id", userId).maybeSingle(),
    supabase.from("member_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("member_wallets").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("member_game_progress")
      .select("*")
      .eq("user_id", userId)
      .order("last_played_at", { ascending: false, nullsFirst: false })
      .limit(8),
    supabase.from("member_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(8),
    supabase
      .from("member_wallet_ledger")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("member_game_rounds")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("member_ad_rewards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("member_purchases").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(8),
  ])
  const supabaseErrors = [
    ["profiles", profileResult.error],
    ["member_settings", settingsResult.error],
    ["member_wallets", walletResult.error],
    ["member_game_progress", progressResult.error],
    ["member_events", eventResult.error],
    ["member_wallet_ledger", ledgerResult.error],
    ["member_game_rounds", roundResult.error],
    ["member_ad_rewards", adRewardResult.error],
    ["member_purchases", purchaseResult.error],
  ].filter(([, error]) => error)

  if (supabaseErrors.length > 0) {
    throw new Error(
      `Supabase member overview query failed: ${supabaseErrors
        .map(([table, error]) => `${table}: ${formatSupabaseError(error)}`)
        .join("; ")}`,
    )
  }

  return {
    session: auth.session,
    profile: toProfile(auth.session, profileResult.data),
    settings: toSettings(settingsResult.data),
    wallet: toWallet(walletResult.data),
    progress: Array.isArray(progressResult.data) ? progressResult.data.map((row) => toProgress(row)) : [],
    recentEvents: Array.isArray(eventResult.data) ? eventResult.data.map((row) => toEvent(row)) : [],
    walletLedger: Array.isArray(ledgerResult.data) ? ledgerResult.data.map((row) => toWalletLedgerEntry(row)) : [],
    gameRounds: Array.isArray(roundResult.data) ? roundResult.data.map((row) => toGameRound(row)) : [],
    adRewards: Array.isArray(adRewardResult.data) ? adRewardResult.data.map((row) => toAdReward(row)) : [],
    purchases: Array.isArray(purchaseResult.data) ? purchaseResult.data.map((row) => toPurchase(row)) : [],
  }
}

function readLocalOverview(auth: AuthenticatedMember, cookieStore: CookieStore): MemberOverview {
  const state = readStateToken(cookieStore.get(MEMBER_STATE_COOKIE)?.value)
  const profile = {
    ...defaultProfile(auth.session),
    ...state.profile,
    account: auth.session.account,
    provider: auth.session.provider ?? "local",
    loginAt: auth.session.loginAt,
  }

  return {
    session: auth.session,
    profile,
    settings: mergeSettings(state.settings),
    wallet: {
      ...defaultWallet(),
      ...state.wallet,
      currency: "USD",
    },
    progress: state.progress ?? [],
    recentEvents: state.recentEvents ?? [],
    walletLedger: state.walletLedger ?? [],
    gameRounds: state.gameRounds ?? [],
    adRewards: state.adRewards ?? [],
    purchases: state.purchases ?? [],
  }
}

export async function readMemberOverview(cookieStore: CookieStore, response?: NextResponse) {
  const auth = await getAuthenticatedMember(cookieStore, response)

  if (!auth) {
    return null
  }

  if (auth.source === "supabase") {
    return readSupabaseOverview(auth)
  }

  return readLocalOverview(auth, cookieStore)
}

export async function updateMemberProfile(cookieStore: CookieStore, response: NextResponse, body: unknown) {
  const auth = await getAuthenticatedMember(cookieStore, response)

  if (!auth) {
    return null
  }

  const patchBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const displayName = normalizeDisplayName(patchBody.displayName)
  const avatarUrl = normalizeAvatarUrl(patchBody.avatarUrl)

  if (!displayName && avatarUrl === undefined) {
    throw new Error("No valid profile changes were provided.")
  }

  if (auth.source === "supabase") {
    const userId = auth.session.userId

    if (!auth.supabase || !userId) {
      throw new Error("Supabase member session is missing a user id.")
    }

    const update = {
      id: userId,
      ...(displayName ? { display_name: displayName } : {}),
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
    }
    const { data, error } = await auth.supabase
      .from("profiles")
      .upsert(update)
      .select("id, display_name, avatar_url, created_at, updated_at")
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return toProfile(auth.session, data)
  }

  const state = readStateToken(cookieStore.get(MEMBER_STATE_COOKIE)?.value)
  const profile = {
    ...defaultProfile(auth.session),
    ...state.profile,
    ...(displayName ? { displayName } : {}),
    ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    updatedAt: nowIso(),
  }

  writeLocalState(response, {
    ...state,
    profile,
  })

  return profile
}

export async function updateMemberSettings(cookieStore: CookieStore, response: NextResponse, body: unknown) {
  const auth = await getAuthenticatedMember(cookieStore, response)

  if (!auth) {
    return null
  }

  const patchBody = body && typeof body === "object" ? (body as Partial<MemberSettings>) : {}
  const overview = auth.source === "supabase" ? await readSupabaseOverview(auth) : readLocalOverview(auth, cookieStore)
  const settings = mergeSettings({
    ...overview.settings,
    ...patchBody,
  })

  if (auth.source === "supabase") {
    const userId = auth.session.userId

    if (!auth.supabase || !userId) {
      throw new Error("Supabase member session is missing a user id.")
    }

    const { data, error } = await auth.supabase
      .from("member_settings")
      .upsert({
        user_id: userId,
        theme: settings.theme,
        language: settings.language,
        sound_enabled: settings.soundEnabled,
        notification_enabled: settings.notificationEnabled,
        marketing_opt_in: settings.marketingOptIn,
        profile_visibility: settings.profileVisibility,
        quick_bet_amount: settings.quickBetAmount,
        table_density: settings.tableDensity,
        responsible_limit: settings.responsibleLimit,
      })
      .select("*")
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return toSettings(data)
  }

  const state = readStateToken(cookieStore.get(MEMBER_STATE_COOKIE)?.value)
  writeLocalState(response, {
    ...state,
    settings,
  })

  return settings
}

async function findSupabaseRoundByIdempotencyKey(userId: string, idempotencyKey: string) {
  const serviceSupabase = createSupabaseServiceClient()
  const { data, error } = await serviceSupabase
    .from("member_game_rounds")
    .select("*")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? toGameRound(data) : null
}

async function insertSupabaseGameRound({
  userId,
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
  idempotencyKey,
}: {
  userId: string
  gameSlug: string
  tableSessionId?: string | null
  outcome: ProgressOutcome
  delta: number
  totalStake: number
  chipBalanceBefore?: number | null
  chipBalanceAfter?: number | null
  summary: string
  betSnapshot: Record<string, unknown>
  resultSnapshot: Record<string, unknown>
  idempotencyKey: string | null
}) {
  const serviceSupabase = createSupabaseServiceClient()
  const { data, error } = await serviceSupabase
    .from("member_game_rounds")
    .insert({
      user_id: userId,
      game_slug: gameSlug,
      table_session_id: tableSessionId ?? null,
      round_status: "settled",
      total_stake: totalStake,
      delta,
      outcome,
      chip_balance_before: chipBalanceBefore ?? null,
      chip_balance_after: chipBalanceAfter ?? null,
      result_summary: summary,
      bet_snapshot: betSnapshot,
      result_snapshot: resultSnapshot,
      idempotency_key: idempotencyKey,
    })
    .select("*")
    .single()

  if (error) {
    if (idempotencyKey && error.code === "23505") {
      return findSupabaseRoundByIdempotencyKey(userId, idempotencyKey)
    }

    throw new Error(error.message)
  }

  return toGameRound(data)
}

export async function applyTestWalletTopUp(cookieStore: CookieStore, response: NextResponse, body: unknown) {
  if (process.env.NODE_ENV === "production" && process.env.TAIHU_ENABLE_TEST_WALLET_TOPUP !== "true") {
    throw new Error("Test wallet top-up is disabled.")
  }

  const patchBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const amount = Math.min(100000, Math.max(1, normalizeMoney(patchBody.amount, 1000)))
  const idempotencyKey =
    typeof patchBody.idempotencyKey === "string"
      ? patchBody.idempotencyKey.slice(0, 160)
      : `test-topup-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const walletEntry = await applyWalletEntry(cookieStore, response, {
    source: "admin_adjustment",
    amount,
    idempotencyKey,
    metadata: {
      reason: "settings_test_topup",
      testOnly: true,
    },
  })

  if (!walletEntry) {
    return null
  }

  return walletEntry
}

function normalizeEventKind(value: unknown) {
  const kind = typeof value === "string" ? value.trim().slice(0, 80) : ""

  return MEMBER_EVENT_KINDS.has(kind) ? kind : "wallet_update"
}

function normalizeAdRewardPlacement(value: unknown): AdRewardPlacement {
  return value === "loss_recovery" || value === "lobby_reward" ? value : "daily_bonus"
}

function rewardAmountForPlacement(placement: AdRewardPlacement) {
  return placement === "loss_recovery" ? 250 : placement === "lobby_reward" ? 100 : 150
}

function findMemberProduct(productId: unknown) {
  const id = typeof productId === "string" ? productId.trim() : ""

  return MEMBER_PRODUCTS.find((product) => product.id === id) ?? null
}

export function listMemberProducts() {
  return MEMBER_PRODUCTS
}

export async function recordMemberEvent(cookieStore: CookieStore, response: NextResponse, body: unknown) {
  const auth = await getAuthenticatedMember(cookieStore, response)

  if (!auth) {
    return null
  }

  const patchBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const createdAt = nowIso()
  const event: MemberEvent = {
    id: `${createdAt}-${Math.random().toString(16).slice(2)}`,
    kind: normalizeEventKind(patchBody.kind),
    title: typeof patchBody.title === "string" && patchBody.title.trim() ? patchBody.title.trim().slice(0, 80) : "Member event",
    detail: typeof patchBody.detail === "string" ? patchBody.detail.trim().slice(0, LOCAL_STATE_SUMMARY_LIMIT) : "",
    createdAt,
  }

  if (auth.source === "supabase") {
    if (!auth.session.userId) {
      throw new Error("Supabase member session is missing a user id.")
    }

    const serviceSupabase = createSupabaseServiceClient()
    const { data, error } = await serviceSupabase
      .from("member_events")
      .insert({
        user_id: auth.session.userId,
        kind: event.kind,
        title: event.title,
        detail: event.detail,
      })
      .select("*")
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return toEvent(data)
  }

  const state = readStateToken(cookieStore.get(MEMBER_STATE_COOKIE)?.value)
  writeLocalState(response, {
    ...state,
    recentEvents: compactLocalEvents([event, ...(state.recentEvents ?? [])]),
  })

  return event
}

export async function startAdReward(cookieStore: CookieStore, response: NextResponse, body: unknown) {
  requireStubCreditingEnabled()

  const auth = await getAuthenticatedMember(cookieStore, response)

  if (!auth) {
    return null
  }

  const patchBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const placement = normalizeAdRewardPlacement(patchBody.placement)
  const rewardAmount = rewardAmountForPlacement(placement)

  if (auth.source === "supabase") {
    if (!auth.session.userId) {
      throw new Error("Supabase member session is missing a user id.")
    }

    const serviceSupabase = createSupabaseServiceClient()
    const { data, error } = await serviceSupabase
      .from("member_ad_rewards")
      .insert({
        user_id: auth.session.userId,
        placement,
        reward_amount: rewardAmount,
        status: "started",
      })
      .select("*")
      .single()

    if (error) {
      throw new Error(error.message)
    }

    await serviceSupabase.from("member_events").insert({
      user_id: auth.session.userId,
      kind: "ad_reward_start",
      title: `Ad reward started: ${placement}`,
      detail: `Reward amount ${rewardAmount}`,
    })

    return toAdReward(data)
  }

  const state = readStateToken(cookieStore.get(MEMBER_STATE_COOKIE)?.value)
  const createdAt = nowIso()
  const adReward: MemberAdReward = {
    id: `${createdAt}-${Math.random().toString(16).slice(2)}`,
    placement,
    rewardAmount,
    status: "started",
    createdAt,
    creditedAt: null,
  }
  const event: MemberEvent = {
    id: `${createdAt}-ad-start`,
    kind: "ad_reward_start",
    title: `Ad reward started: ${placement}`,
    detail: `Reward amount ${rewardAmount}`,
    createdAt,
  }

  writeLocalState(response, {
    ...state,
    adRewards: [adReward, ...(state.adRewards ?? [])].slice(0, 8),
    recentEvents: compactLocalEvents([event, ...(state.recentEvents ?? [])]),
  })

  return adReward
}

export async function completeAdReward(cookieStore: CookieStore, response: NextResponse, body: unknown) {
  requireStubCreditingEnabled()

  const auth = await getAuthenticatedMember(cookieStore, response)

  if (!auth) {
    return null
  }

  const patchBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const rewardId = typeof patchBody.rewardId === "string" ? patchBody.rewardId : null
  const placement = normalizeAdRewardPlacement(patchBody.placement)

  if (auth.source === "supabase") {
    if (!auth.session.userId) {
      throw new Error("Supabase member session is missing a user id.")
    }

    const serviceSupabase = createSupabaseServiceClient()
    const query = serviceSupabase
      .from("member_ad_rewards")
      .select("*")
      .eq("user_id", auth.session.userId)
      .eq("status", "started")
      .order("created_at", { ascending: false })
      .limit(1)

    const { data: adRewardRows, error: readError } = rewardId
      ? await query.eq("id", rewardId)
      : await query.eq("placement", placement)

    if (readError) {
      throw new Error(readError.message)
    }

    const adReward = Array.isArray(adRewardRows) && adRewardRows[0] ? toAdReward(adRewardRows[0]) : null

    if (!adReward) {
      throw new Error("No started ad reward was found.")
    }

    const walletEntry = await applyAuthenticatedWalletEntry(auth, cookieStore, response, {
      source: "ad_reward",
      amount: adReward.rewardAmount,
      referenceId: adReward.id,
      idempotencyKey: createStubCreditIdempotencyKey("ad-reward", adReward.id),
      metadata: { placement: adReward.placement },
    })
    const { data: updatedReward, error: updateError } = await serviceSupabase
      .from("member_ad_rewards")
      .update({
        status: "credited",
        credited_at: walletEntry.createdAt,
      })
      .eq("id", adReward.id)
      .eq("user_id", auth.session.userId)
      .select("*")
      .single()

    let creditedRewardRow = updatedReward

    if (updateError) {
      if (!updateError.message.toLowerCase().includes("permission denied")) {
        throw new Error(updateError.message)
      }

      const { data: insertedReward, error: insertError } = await serviceSupabase
        .from("member_ad_rewards")
        .insert({
          user_id: auth.session.userId,
          placement: adReward.placement,
          reward_amount: adReward.rewardAmount,
          status: "credited",
          credited_at: walletEntry.createdAt,
        })
        .select("*")
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      creditedRewardRow = insertedReward
    }

    await serviceSupabase.from("member_events").insert({
      user_id: auth.session.userId,
      kind: "ad_reward_complete",
      title: `Ad reward credited: ${adReward.placement}`,
      detail: `Wallet credited ${adReward.rewardAmount}`,
    })

    return {
      adReward: toAdReward(creditedRewardRow),
      walletEntry,
      wallet: await readAuthenticatedWallet(auth),
    }
  }

  const state = readStateToken(cookieStore.get(MEMBER_STATE_COOKIE)?.value)
  const adRewards = [...(state.adRewards ?? [])]
  const adRewardIndex = adRewards.findIndex((reward) =>
    reward.status === "started" && (rewardId ? reward.id === rewardId : reward.placement === placement),
  )

  if (adRewardIndex < 0) {
    throw new Error("No started ad reward was found.")
  }

  const adReward = adRewards[adRewardIndex]
  const walletEntry = applyLocalWalletEntry(auth, cookieStore, response, {
    source: "ad_reward",
    amount: adReward.rewardAmount,
    referenceId: adReward.id,
    idempotencyKey: createStubCreditIdempotencyKey("ad-reward", adReward.id),
    metadata: { placement: adReward.placement },
  })
  const refreshedState = readStateToken(response.cookies.get(MEMBER_STATE_COOKIE)?.value ?? cookieStore.get(MEMBER_STATE_COOKIE)?.value)
  const creditedReward: MemberAdReward = {
    ...adReward,
    status: "credited",
    creditedAt: walletEntry.createdAt,
  }
  adRewards[adRewardIndex] = creditedReward
  const event: MemberEvent = {
    id: `${walletEntry.createdAt}-ad-complete`,
    kind: "ad_reward_complete",
    title: `Ad reward credited: ${adReward.placement}`,
    detail: `Wallet credited ${adReward.rewardAmount}`,
    createdAt: walletEntry.createdAt,
  }

  writeLocalState(response, {
    ...refreshedState,
    adRewards,
    recentEvents: compactLocalEvents([event, ...(refreshedState.recentEvents ?? [])]),
  })

  return {
    adReward: creditedReward,
    walletEntry,
    wallet: {
      ...defaultWallet(),
      ...refreshedState.wallet,
      balance: walletEntry.balanceAfter,
      updatedAt: walletEntry.createdAt,
      currency: "USD" as const,
    },
  }
}

export async function createPurchase(cookieStore: CookieStore, response: NextResponse, body: unknown) {
  requireStubCreditingEnabled()

  const auth = await getAuthenticatedMember(cookieStore, response)

  if (!auth) {
    return null
  }

  const patchBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const product = findMemberProduct(patchBody.productId)
  const providerReference =
    typeof patchBody.idempotencyKey === "string" && patchBody.idempotencyKey.trim()
      ? `stub:${patchBody.idempotencyKey.trim().slice(0, 140)}`
      : `stub:${Date.now()}-${Math.random().toString(16).slice(2)}`

  if (!product) {
    throw new Error("A valid product id is required.")
  }

  if (auth.source === "supabase") {
    if (!auth.session.userId) {
      throw new Error("Supabase member session is missing a user id.")
    }

    const serviceSupabase = createSupabaseServiceClient()
    const { data, error } = await serviceSupabase
      .from("member_purchases")
      .insert({
        user_id: auth.session.userId,
        product_id: product.id,
        amount: product.amount,
        credits: product.credits,
        status: "created",
        provider: "stub",
        provider_reference: providerReference,
      })
      .select("*")
      .single()

    if (error) {
      if (error.code === "23505") {
        const { data: existing, error: existingError } = await serviceSupabase
          .from("member_purchases")
          .select("*")
          .eq("user_id", auth.session.userId)
          .eq("provider", "stub")
          .eq("provider_reference", providerReference)
          .maybeSingle()

        if (existingError) {
          throw new Error(existingError.message)
        }

        if (existing) {
          return toPurchase(existing)
        }
      }

      throw new Error(error.message)
    }

    await serviceSupabase.from("member_events").insert({
      user_id: auth.session.userId,
      kind: "purchase_attempt",
      title: `Purchase created: ${product.id}`,
      detail: `Stub purchase for ${product.credits} credits`,
    })

    return toPurchase(data)
  }

  const state = readStateToken(cookieStore.get(MEMBER_STATE_COOKIE)?.value)
  const existing = (state.purchases ?? []).find((purchase) => purchase.providerReference === providerReference)

  if (existing) {
    return existing
  }

  const createdAt = nowIso()
  const purchase: MemberPurchase = {
    id: `${createdAt}-${Math.random().toString(16).slice(2)}`,
    productId: product.id,
    amount: product.amount,
    credits: product.credits,
    status: "created",
    provider: "stub",
    providerReference,
    createdAt,
    creditedAt: null,
  }
  const event: MemberEvent = {
    id: `${createdAt}-purchase-attempt`,
    kind: "purchase_attempt",
    title: `Purchase created: ${product.id}`,
    detail: `Stub purchase for ${product.credits} credits`,
    createdAt,
  }

  writeLocalState(response, {
    ...state,
    purchases: [purchase, ...(state.purchases ?? [])].slice(0, 8),
    recentEvents: compactLocalEvents([event, ...(state.recentEvents ?? [])]),
  })

  return purchase
}

export async function completePurchase(cookieStore: CookieStore, response: NextResponse, purchaseId: string) {
  requireStubCreditingEnabled()

  const auth = await getAuthenticatedMember(cookieStore, response)

  if (!auth) {
    return null
  }

  if (auth.source === "supabase") {
    if (!auth.session.userId) {
      throw new Error("Supabase member session is missing a user id.")
    }

    const serviceSupabase = createSupabaseServiceClient()
    const { data: purchaseRow, error: readError } = await serviceSupabase
      .from("member_purchases")
      .select("*")
      .eq("id", purchaseId)
      .eq("user_id", auth.session.userId)
      .maybeSingle()

    if (readError) {
      throw new Error(readError.message)
    }

    if (!purchaseRow) {
      throw new Error("Purchase was not found.")
    }

    const purchase = toPurchase(purchaseRow)

    if (purchase.status === "credited") {
      return {
        purchase,
        walletEntry: null,
        wallet: await readAuthenticatedWallet(auth),
      }
    }

    const walletEntry = await applyAuthenticatedWalletEntry(auth, cookieStore, response, {
      source: "purchase",
      amount: purchase.credits,
      referenceId: purchase.id,
      idempotencyKey: createStubCreditIdempotencyKey("purchase", purchase.id),
      metadata: { productId: purchase.productId, provider: purchase.provider },
    })
    const { data: updatedPurchase, error: updateError } = await serviceSupabase
      .from("member_purchases")
      .update({
        status: "credited",
        credited_at: walletEntry.createdAt,
      })
      .eq("id", purchase.id)
      .eq("user_id", auth.session.userId)
      .select("*")
      .single()

    let creditedPurchaseRow = updatedPurchase

    if (updateError) {
      if (!updateError.message.toLowerCase().includes("permission denied")) {
        throw new Error(updateError.message)
      }

      const fallbackReference = `${purchase.providerReference ?? purchase.id}:credited`
      const { data: insertedPurchase, error: insertError } = await serviceSupabase
        .from("member_purchases")
        .insert({
          user_id: auth.session.userId,
          product_id: purchase.productId,
          amount: purchase.amount,
          credits: purchase.credits,
          status: "credited",
          provider: purchase.provider,
          provider_reference: fallbackReference,
          credited_at: walletEntry.createdAt,
        })
        .select("*")
        .single()

      if (insertError) {
        if (insertError.code === "23505") {
          const { data: existingPurchase, error: existingError } = await serviceSupabase
            .from("member_purchases")
            .select("*")
            .eq("user_id", auth.session.userId)
            .eq("provider", purchase.provider)
            .eq("provider_reference", fallbackReference)
            .maybeSingle()

          if (existingError) {
            throw new Error(existingError.message)
          }

          if (!existingPurchase) {
            throw new Error(insertError.message)
          }

          creditedPurchaseRow = existingPurchase
        } else {
          throw new Error(insertError.message)
        }
      } else {
        creditedPurchaseRow = insertedPurchase
      }
    }

    await serviceSupabase.from("member_events").insert({
      user_id: auth.session.userId,
      kind: "purchase_success",
      title: `Purchase credited: ${purchase.productId}`,
      detail: `Wallet credited ${purchase.credits}`,
    })

    return {
      purchase: toPurchase(creditedPurchaseRow),
      walletEntry,
      wallet: await readAuthenticatedWallet(auth),
    }
  }

  const state = readStateToken(cookieStore.get(MEMBER_STATE_COOKIE)?.value)
  const purchases = [...(state.purchases ?? [])]
  const purchaseIndex = purchases.findIndex((purchase) => purchase.id === purchaseId)

  if (purchaseIndex < 0) {
    throw new Error("Purchase was not found.")
  }

  const purchase = purchases[purchaseIndex]

  if (purchase.status === "credited") {
    return {
      purchase,
      walletEntry: null,
      wallet: {
        ...defaultWallet(),
        ...state.wallet,
        currency: "USD" as const,
      },
    }
  }

  const walletEntry = applyLocalWalletEntry(auth, cookieStore, response, {
    source: "purchase",
    amount: purchase.credits,
    referenceId: purchase.id,
    idempotencyKey: createStubCreditIdempotencyKey("purchase", purchase.id),
    metadata: { productId: purchase.productId, provider: purchase.provider },
  })
  const refreshedState = readStateToken(response.cookies.get(MEMBER_STATE_COOKIE)?.value ?? cookieStore.get(MEMBER_STATE_COOKIE)?.value)
  const creditedPurchase: MemberPurchase = {
    ...purchase,
    status: "credited",
    creditedAt: walletEntry.createdAt,
  }
  purchases[purchaseIndex] = creditedPurchase
  const event: MemberEvent = {
    id: `${walletEntry.createdAt}-purchase-success`,
    kind: "purchase_success",
    title: `Purchase credited: ${purchase.productId}`,
    detail: `Wallet credited ${purchase.credits}`,
    createdAt: walletEntry.createdAt,
  }

  writeLocalState(response, {
    ...refreshedState,
    purchases,
    recentEvents: compactLocalEvents([event, ...(refreshedState.recentEvents ?? [])]),
  })

  return {
    purchase: creditedPurchase,
    walletEntry,
    wallet: {
      ...defaultWallet(),
      ...refreshedState.wallet,
      balance: walletEntry.balanceAfter,
      updatedAt: walletEntry.createdAt,
      currency: "USD" as const,
    },
  }
}

function settlementFromGameRound(round: MemberGameRound) {
  return {
    outcome: round.outcome,
    delta: round.delta,
    totalStake: round.totalStake,
    summary: round.resultSummary,
    betSnapshot: round.betSnapshot,
    resultSnapshot: round.resultSnapshot,
  }
}

export async function recordGameProgress(cookieStore: CookieStore, response: NextResponse, body: unknown) {
  const auth = await getAuthenticatedMember(cookieStore, response)

  if (!auth) {
    return null
  }

  const patchBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const gameSlug = typeof patchBody.gameSlug === "string" ? patchBody.gameSlug.slice(0, 80) : ""
  const table = getPlayableTable(gameSlug)

  if (!gameSlug || !table) {
    throw new Error("Game slug is not playable.")
  }

  const idempotencyKey = typeof patchBody.idempotencyKey === "string" ? patchBody.idempotencyKey.slice(0, 160) : null
  const tableSessionId = typeof patchBody.tableSessionId === "string" ? patchBody.tableSessionId.slice(0, 80) : null

  if (!idempotencyKey || !tableSessionId) {
    throw new Error("A table session and idempotency key are required for authoritative settlement.")
  }

  const settlement = settleAuthoritativeRound(table.ruleSet, normalizeRecord(patchBody.betSnapshot))
  const { outcome, delta, totalStake, summary, betSnapshot, resultSnapshot } = settlement
  const playedAt = nowIso()
  const event: MemberEvent = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind: "game",
    title: `${gameSlug} ${outcome}`,
    detail: summary,
    createdAt: playedAt,
  }

  if (auth.source === "supabase") {
    const userId = auth.session.userId

    if (!auth.supabase || !userId) {
      throw new Error("Supabase member session is missing a user id.")
    }

    const tableRound = await settleSupabaseTableSessionRound(auth, {
      sessionId: tableSessionId,
      gameSlug,
      outcome,
      delta,
      totalStake,
      summary,
      betSnapshot,
      resultSnapshot,
      idempotencyKey,
    })
    if (tableRound.idempotent) {
      const existingRound = await findSupabaseRoundByIdempotencyKey(userId, idempotencyKey)
      if (!existingRound) throw new Error("Idempotent table round could not be loaded.")
      return { progress: tableRound.progress, settlement: settlementFromGameRound(existingRound), idempotent: true }
    }
    return { progress: tableRound.progress, settlement, idempotent: false }
  }

  {
    const state = readStateToken(cookieStore.get(MEMBER_STATE_COOKIE)?.value)
    const existingRound =
      idempotencyKey && state.gameRounds
        ? state.gameRounds.find((round) => round.idempotencyKey === idempotencyKey)
        : undefined
    const progress = [...(state.progress ?? [])]
    const existingIndex = progress.findIndex((item) => item.gameSlug === gameSlug)
    const current = existingIndex >= 0 ? progress[existingIndex] : undefined

    if (existingRound && current) {
      return { progress: current, settlement: settlementFromGameRound(existingRound), idempotent: true }
    }

    const sessions = [...(state.tableSessions ?? [])]
    const sessionIndex = sessions.findIndex((session) => session.id === tableSessionId && session.status === "active")
    const tableSession = sessionIndex >= 0 ? sessions[sessionIndex] : null

    if (!tableSession) {
      throw new Error("Active table session was not found.")
    }

    if (tableSession.gameSlug !== gameSlug) {
      throw new Error("Table session game does not match round game.")
    }

    const chipBalanceBefore = tableSession.chipBalance

    if (totalStake > chipBalanceBefore) {
      throw new Error("Insufficient table chips for this stake.")
    }

    const chipBalanceAfter = Math.round((chipBalanceBefore + delta) * 100) / 100

    if (chipBalanceAfter < 0) {
      throw new Error("Insufficient table chips.")
    }

    const nextSession: MemberTableSession = {
      ...tableSession,
      chipBalance: chipBalanceAfter,
      updatedAt: playedAt,
    }
    sessions[sessionIndex] = nextSession
    const streak = outcome === "win" ? (current?.streak ?? 0) + 1 : outcome === "loss" ? 0 : current?.streak ?? 0
    const nextProgress: MemberGameProgress = {
      gameSlug,
      plays: (current?.plays ?? 0) + 1,
      wins: (current?.wins ?? 0) + (outcome === "win" ? 1 : 0),
      losses: (current?.losses ?? 0) + (outcome === "loss" ? 1 : 0),
      streak,
      bestStreak: Math.max(current?.bestStreak ?? 0, streak),
      bankroll: chipBalanceAfter,
      lastResult: outcome,
      lastDelta: delta,
      lastSummary: summary,
      lastPlayedAt: playedAt,
    }

    if (existingIndex >= 0) {
      progress[existingIndex] = nextProgress
    } else {
      progress.unshift(nextProgress)
    }

    writeLocalState(response, {
      ...state,
      progress: compactLocalProgress(progress),
      recentEvents: compactLocalEvents([event, ...(state.recentEvents ?? [])]),
      tableSessions: compactLocalTableSessions(sessions),
      gameRounds: compactLocalGameRounds([
        {
          id: `${playedAt}-${Math.random().toString(16).slice(2)}`,
          gameSlug,
          tableSessionId,
          roundStatus: "settled",
          totalStake,
          delta,
          outcome,
          chipBalanceBefore,
          chipBalanceAfter,
          resultSummary: summary,
          betSnapshot,
          resultSnapshot: {
            ...resultSnapshot,
            tableSessionId,
            chipBalanceBefore,
            chipBalanceAfter,
          },
          idempotencyKey,
          createdAt: playedAt,
        },
        ...(state.gameRounds ?? []),
      ]),
    })

    return { progress: nextProgress, settlement, idempotent: false }
  }
}

export function isSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin")

  if (!origin) {
    return true
  }

  let originUrl: URL

  try {
    originUrl = new URL(origin)
  } catch {
    return false
  }

  const requestUrl = new URL(request.url)

  if (originUrl.origin === requestUrl.origin) {
    return true
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1"])

  return (
    localHosts.has(originUrl.hostname) &&
    localHosts.has(requestUrl.hostname) &&
    originUrl.protocol === requestUrl.protocol &&
    originUrl.port === requestUrl.port
  )
}
