import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { BaccaratTablePage } from "@/components/baccarat-table-page"
import { BlackjackTablePage } from "@/components/blackjack-table-page"
import { DiceTablePage } from "@/components/dice-table-page"
import { GameTablePage } from "@/components/game-table-page"
import { MemberGameFrame } from "@/components/member-game-frame"
import { RouletteTablePage } from "@/components/roulette-table-page"
import { getPlayableTable, playableTableEntries } from "@/lib/game-catalog"
import { readActiveTableSession, readMemberOverview } from "@/lib/member-data"

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

  const initialProgress = member.progress.find((progress) => progress.gameSlug === game.slug) ?? null
  const initialTableSession = await readActiveTableSession(cookieStore, game.slug)
  const gameStateProps = {
    initialWalletBalance: member.wallet.balance,
    initialProgress,
  }

  let page = <GameTablePage entry={game} defaultLanguage={member.settings.language} {...gameStateProps} />

  if (game.ruleSet === "baccarat") {
    page = (
      <BaccaratTablePage
        entry={game}
        defaultLanguage={member.settings.language}
        initialTableSession={initialTableSession}
        {...gameStateProps}
      />
    )
  }

  if (game.ruleSet === "blackjack") {
    page = (
      <BlackjackTablePage
        entry={game}
        defaultLanguage={member.settings.language}
        initialTableSession={initialTableSession}
        {...gameStateProps}
      />
    )
  }

  if (game.ruleSet === "roulette") {
    page = (
      <RouletteTablePage
        entry={game}
        defaultLanguage={member.settings.language}
        initialTableSession={initialTableSession}
        {...gameStateProps}
      />
    )
  }

  if (game.ruleSet === "dice") {
    page = (
      <DiceTablePage
        entry={game}
        defaultLanguage={member.settings.language}
        initialTableSession={initialTableSession}
        {...gameStateProps}
      />
    )
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
