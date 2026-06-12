import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { readAccountDeletionRequest, updateAccountDeletionRequest } from "@/lib/account-rights"
import { ACCOUNT_DELETION_CONFIRMATION } from "@/lib/legal"
import { isSameOriginMutation } from "@/lib/member-data"
import { enforceRateLimit } from "@/lib/rate-limit"

export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, "member.account-deletion")
  if (limited) return limited
  const response = NextResponse.json({ request: null }, { headers: { "cache-control": "private, no-store" } })
  const result = await readAccountDeletionRequest(await cookies(), response)
  if (!result) return NextResponse.json({ error: "Authentication is required." }, { status: 401, headers: response.headers })
  return NextResponse.json(result, { headers: response.headers })
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 })
  const body = (await request.json().catch(() => null)) as { action?: unknown; confirmation?: unknown; reason?: unknown } | null
  const action = body?.action
  if (action !== "request" && action !== "confirm" && action !== "cancel") {
    return NextResponse.json({ error: "A valid deletion request action is required." }, { status: 400 })
  }
  if (action === "confirm" && body?.confirmation !== ACCOUNT_DELETION_CONFIRMATION) {
    return NextResponse.json({ error: `Type ${ACCOUNT_DELETION_CONFIRMATION} to confirm.` }, { status: 400 })
  }
  const limited = await enforceRateLimit(request, "member.account-deletion", { identifiers: [action] })
  if (limited) return limited
  const response = NextResponse.json({ request: null }, { headers: { "cache-control": "private, no-store" } })

  try {
    const result = await updateAccountDeletionRequest(await cookies(), response, {
      action,
      confirmation: typeof body?.confirmation === "string" ? body.confirmation : undefined,
      reason: typeof body?.reason === "string" ? body.reason : undefined,
    })
    if (!result) return NextResponse.json({ error: "Authentication is required." }, { status: 401, headers: response.headers })
    return NextResponse.json(result, { headers: response.headers })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update deletion request." }, { status: 400, headers: response.headers })
  }
}
