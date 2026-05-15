import { NextResponse } from "next/server"

import { listMemberProducts } from "@/lib/member-data"

export async function GET() {
  return NextResponse.json(
    { products: listMemberProducts() },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  )
}
