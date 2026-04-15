import { notFound } from "next/navigation"

import { GamePlaceholderPage } from "@/components/game-placeholder-page"
import { coreGames, getCoreGame } from "@/lib/home-content"

export function generateStaticParams() {
  return coreGames.map((game) => ({ slug: game.slug }))
}

export default async function GameRoutePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const game = getCoreGame(slug)

  if (!game) {
    notFound()
  }

  return <GamePlaceholderPage game={game} />
}
