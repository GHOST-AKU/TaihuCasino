import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { BaccaratTablePage } from "@/components/baccarat-table-page"
import { BlackjackTablePage } from "@/components/blackjack-table-page"
import { DiceTablePage } from "@/components/dice-table-page"
import { GameTablePage } from "@/components/game-table-page"
import { MemberGameFrame } from "@/components/member-game-frame"
import { RouletteTablePage } from "@/components/roulette-table-page"
import { getPlayableTable, playableTableEntries } from "@/lib/game-catalog"
import { readMemberOverview } from "@/lib/member-data"

export function generateStaticParams() {
  return playableTableEntries.map((game) => ({ slug: game.slug }))
}

export default async function GameRoutePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const game = getPlayableTable(slug)
  const cookieStore = await cookies()
  const member = await readMemberOverview(cookieStore)

  if (!game) {
    notFound()
  }

  if (!member) {
    redirect(`/login?next=${encodeURIComponent(`/games/${slug}`)}`)
  }

  let page = <GameTablePage entry={game} defaultLanguage={member.settings.language} />

  if (game.ruleSet === "baccarat") {
    page = <BaccaratTablePage entry={game} defaultLanguage={member.settings.language} />
  }

  if (game.ruleSet === "blackjack") {
    page = <BlackjackTablePage entry={game} defaultLanguage={member.settings.language} />
  }

  if (game.ruleSet === "roulette") {
    page = <RouletteTablePage entry={game} defaultLanguage={member.settings.language} />
  }

  if (game.ruleSet === "dice") {
    page = <DiceTablePage entry={game} defaultLanguage={member.settings.language} />
  }

  return (
    <MemberGameFrame
      initialLanguage={member.settings.language}
      memberName={member.profile.displayName}
    >
      {page}
    </MemberGameFrame>
  )
}
