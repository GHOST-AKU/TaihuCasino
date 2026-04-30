import { readFile } from "node:fs/promises"
import path from "node:path"

import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { allCasinoCatalogEntries, getCasinoCatalogEntry } from "@/lib/game-catalog"
import { readMemberOverview } from "@/lib/member-data"

export function generateStaticParams() {
  return allCasinoCatalogEntries
    .filter((entry) => Boolean(entry.legacyFile))
    .map((entry) => ({ slug: entry.slug }))
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const entry = getCasinoCatalogEntry(slug)

  if (!entry?.legacyFile) {
    return new NextResponse("Not Found", { status: 404 })
  }

  const cookieStore = await cookies()
  const member = await readMemberOverview(cookieStore)

  if (!member) {
    const requestUrl = new URL(request.url)
    const next = `${requestUrl.pathname}${requestUrl.search}`

    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, requestUrl.origin))
  }

  const htmlPath = path.join(process.cwd(), "pages", entry.legacyFile)
  const html = await readFile(htmlPath, "utf8")

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  })
}
