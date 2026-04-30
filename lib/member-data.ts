import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { cookies } from "next/headers"
import type { NextResponse } from "next/server"

import type { MemberSession } from "@/lib/member-session"
import {
  MEMBER_SESSION_COOKIE,
  createSessionFromSupabaseUser,
  createSupabaseAuthClient,
  getSessionSecret,
  isSupabaseAuthConfigured,
  readSessionToken,
} from "@/lib/server-auth"

type CookieStore = Awaited<ReturnType<typeof cookies>>

export type MemberTheme = "light" | "dark" | "system"
export type MemberLanguage = "zh" | "en"
export type ProfileVisibility = "private" | "friends" | "public"
export type ProgressOutcome = "win" | "loss" | "push"

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

export interface MemberOverview {
  session: MemberSession
  profile: MemberProfile
  settings: MemberSettings
  wallet: MemberWallet
  progress: MemberGameProgress[]
  recentEvents: MemberEvent[]
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
}

export const MEMBER_STATE_COOKIE = "taihu-member-state"
const MEMBER_STATE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const LOCAL_STATE_PROGRESS_LIMIT = 4
const LOCAL_STATE_EVENT_LIMIT = 3
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
    balance: typeof row?.balance === "number" ? row.balance : fallback.balance,
    bonusBalance: typeof row?.bonus_balance === "number" ? row.bonus_balance : fallback.bonusBalance,
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

  const [{ data: profileRow }, { data: settingsRow }, { data: walletRow }, { data: progressRows }, { data: eventRows }] =
    await Promise.all([
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
    ])

  return {
    session: auth.session,
    profile: toProfile(auth.session, profileRow),
    settings: toSettings(settingsRow),
    wallet: toWallet(walletRow),
    progress: Array.isArray(progressRows) ? progressRows.map((row) => toProgress(row)) : [],
    recentEvents: Array.isArray(eventRows) ? eventRows.map((row) => toEvent(row)) : [],
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

export async function recordGameProgress(cookieStore: CookieStore, response: NextResponse, body: unknown) {
  const auth = await getAuthenticatedMember(cookieStore, response)

  if (!auth) {
    return null
  }

  const patchBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const gameSlug = typeof patchBody.gameSlug === "string" ? patchBody.gameSlug.slice(0, 80) : ""
  const outcome = patchBody.outcome === "win" || patchBody.outcome === "loss" || patchBody.outcome === "push" ? patchBody.outcome : null

  if (!gameSlug || !outcome) {
    throw new Error("A game slug and valid outcome are required.")
  }

  const delta = normalizeNumber(patchBody.delta, 0, -1000000, 1000000)
  const bankroll = normalizeNumber(patchBody.bankroll, 25000, 0, 100000000)
  const summary = typeof patchBody.summary === "string" ? patchBody.summary.slice(0, 280) : ""
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

    const { data: existing } = await auth.supabase
      .from("member_game_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("game_slug", gameSlug)
      .maybeSingle()
    const current = existing ? toProgress(existing) : null
    const streak = outcome === "win" ? (current?.streak ?? 0) + 1 : outcome === "loss" ? 0 : current?.streak ?? 0
    const progress = {
      user_id: userId,
      game_slug: gameSlug,
      plays: (current?.plays ?? 0) + 1,
      wins: (current?.wins ?? 0) + (outcome === "win" ? 1 : 0),
      losses: (current?.losses ?? 0) + (outcome === "loss" ? 1 : 0),
      streak,
      best_streak: Math.max(current?.bestStreak ?? 0, streak),
      bankroll,
      last_result: outcome,
      last_delta: delta,
      last_summary: summary,
      last_played_at: playedAt,
    }
    const { data, error } = await auth.supabase.from("member_game_progress").upsert(progress).select("*").single()

    if (error) {
      throw new Error(error.message)
    }

    const [walletResult, eventResult] = await Promise.all([
      auth.supabase.from("member_wallets").upsert({
        user_id: userId,
        currency: "USD",
        balance: bankroll,
      }),
      auth.supabase.from("member_events").insert({
        user_id: userId,
        kind: event.kind,
        title: event.title,
        detail: event.detail,
      }),
    ])

    if (walletResult.error) {
      throw new Error(walletResult.error.message)
    }

    if (eventResult.error) {
      throw new Error(eventResult.error.message)
    }

    return toProgress(data)
  }

  const state = readStateToken(cookieStore.get(MEMBER_STATE_COOKIE)?.value)
  const progress = [...(state.progress ?? [])]
  const existingIndex = progress.findIndex((item) => item.gameSlug === gameSlug)
  const current = existingIndex >= 0 ? progress[existingIndex] : undefined
  const streak = outcome === "win" ? (current?.streak ?? 0) + 1 : outcome === "loss" ? 0 : current?.streak ?? 0
  const nextProgress: MemberGameProgress = {
    gameSlug,
    plays: (current?.plays ?? 0) + 1,
    wins: (current?.wins ?? 0) + (outcome === "win" ? 1 : 0),
    losses: (current?.losses ?? 0) + (outcome === "loss" ? 1 : 0),
    streak,
    bestStreak: Math.max(current?.bestStreak ?? 0, streak),
    bankroll,
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
    wallet: {
      ...defaultWallet(),
      ...state.wallet,
      balance: bankroll,
      updatedAt: playedAt,
    },
    progress: compactLocalProgress(progress),
    recentEvents: compactLocalEvents([event, ...(state.recentEvents ?? [])]),
  })

  return nextProgress
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
