import { readFile } from "node:fs/promises"
import path from "node:path"

import { NextResponse } from "next/server"

import { coreGames, getCoreGame } from "@/lib/home-content"

export function generateStaticParams() {
  return coreGames.map((game) => ({ slug: game.slug }))
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const game = getCoreGame(slug)

  if (!game) {
    return new NextResponse("Not Found", { status: 404 })
  }

  const htmlPath = path.join(process.cwd(), "pages", game.legacyFile)
  const html = await readFile(htmlPath, "utf8")

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  })
}
