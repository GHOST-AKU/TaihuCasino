import "server-only"

import type { cookies } from "next/headers"
import type { NextResponse } from "next/server"

import { createSupabaseServiceClient } from "@/lib/server-auth"
import { getAuthenticatedMember, readMemberOverview } from "@/lib/member-data"

type CookieStore = Awaited<ReturnType<typeof cookies>>

export async function exportAuthenticatedMemberData(cookieStore: CookieStore, response: NextResponse) {
  const auth = await getAuthenticatedMember(cookieStore, response)
  if (!auth) return null

  const overview = await readMemberOverview(cookieStore, response)
  if (!overview) return null

  if (auth.source !== "supabase" || !auth.session.userId) {
    return {
      schemaVersion: "taihu-member-export-v1",
      generatedAt: new Date().toISOString(),
      account: auth.session,
      member: overview,
      consents: [],
      accountDeletionRequests: [],
    }
  }

  const service = createSupabaseServiceClient()
  const [consents, deletionRequests] = await Promise.all([
    service.from("member_consents").select("*").eq("user_id", auth.session.userId).order("accepted_at", { ascending: false }),
    service.from("account_deletion_requests").select("*").eq("user_id", auth.session.userId).order("updated_at", { ascending: false }),
  ])

  if (consents.error) throw new Error(consents.error.message)
  if (deletionRequests.error) throw new Error(deletionRequests.error.message)

  return {
    schemaVersion: "taihu-member-export-v1",
    generatedAt: new Date().toISOString(),
    account: auth.session,
    member: overview,
    consents: consents.data ?? [],
    accountDeletionRequests: deletionRequests.data ?? [],
  }
}

export async function readAccountDeletionRequest(cookieStore: CookieStore, response: NextResponse) {
  const auth = await getAuthenticatedMember(cookieStore, response)
  if (!auth) return null
  if (auth.source !== "supabase" || !auth.session.userId) return { request: null, localOnly: true }

  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from("account_deletion_requests")
    .select("*")
    .eq("user_id", auth.session.userId)
    .in("status", ["requested", "confirmed"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return { request: data, localOnly: false }
}

export async function updateAccountDeletionRequest(
  cookieStore: CookieStore,
  response: NextResponse,
  input: { action: "request" | "confirm" | "cancel"; confirmation?: string; reason?: string },
) {
  const auth = await getAuthenticatedMember(cookieStore, response)
  if (!auth) return null
  if (auth.source !== "supabase" || !auth.session.userId) throw new Error("Account deletion requests require Supabase authentication.")

  const service = createSupabaseServiceClient()
  const userId = auth.session.userId
  const existing = await readAccountDeletionRequest(cookieStore, response)

  if (input.action === "request") {
    if (existing?.request) return existing
    const { data, error } = await service
      .from("account_deletion_requests")
      .insert({ user_id: userId, request_reason: input.reason?.trim().slice(0, 500) || null })
      .select("*")
      .single()
    if (error) throw new Error(error.message)
    return { request: data, localOnly: false }
  }

  if (!existing?.request) throw new Error("No open account deletion request was found.")

  if (input.action === "cancel") {
    const { data, error } = await service
      .from("account_deletion_requests")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("id", existing.request.id)
      .eq("user_id", userId)
      .select("*")
      .single()
    if (error) throw new Error(error.message)
    return { request: data, localOnly: false }
  }

  const loginAt = Date.parse(auth.session.loginAt)
  if (!Number.isFinite(loginAt) || Date.now() - loginAt > 30 * 60 * 1000) {
    throw new Error("Please sign in again before confirming account deletion.")
  }

  const { count, error: activeSessionError } = await service
    .from("member_table_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active")
  if (activeSessionError) throw new Error(activeSessionError.message)
  if ((count ?? 0) > 0) throw new Error("Cash out or close active table sessions before confirming deletion.")

  const { data, error } = await service
    .from("account_deletion_requests")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      metadata: { execution: "awaiting_retention_and_operator_review" },
    })
    .eq("id", existing.request.id)
    .eq("user_id", userId)
    .eq("status", "requested")
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return { request: data, localOnly: false }
}
