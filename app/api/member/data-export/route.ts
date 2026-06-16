import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { exportAuthenticatedMemberData } from "@/lib/account-rights"
import { enforceRateLimit } from "@/lib/rate-limit"

export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, "member.data-export")
  if (limited) return limited

  const response = NextResponse.json({ export: null }, { headers: { "cache-control": "private, no-store" } })
  const data = await exportAuthenticatedMemberData(await cookies(), response)

  if (!data) return NextResponse.json({ error: "Authentication is required." }, { status: 401, headers: response.headers })

  return NextResponse.json(data, {
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="taihu-member-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
