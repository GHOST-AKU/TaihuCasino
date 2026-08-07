import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { GameTableLoader } from "@/components/game-table-loader"
import { MemberGameFrame } from "@/components/member-game-frame"
import { getPlayableTable, playableTableEntries } from "@/lib/game-catalog"
import { readActiveBlackjackRound, readActiveTableSession, readMemberGameOverview } from "@/lib/member-data"

export const dynamic = "force-dynamic"

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

  if (!game) {
    notFound()
  }

  const cookieStore = await cookies()
  const [member, initialTableSession] = await Promise.all([
    readMemberGameOverview(cookieStore, game.slug),
    readActiveTableSession(cookieStore, game.slug),
  ])

  if (!member) {
    redirect(`/login?next=${encodeURIComponent(`/games/${slug}`)}`)
  }

  const initialProgress = member.progress.find((progress) => progress.gameSlug === game.slug) ?? null
  const initialGameRounds = member.gameRounds.filter(
    (round) => round.gameSlug === game.slug && round.tableSessionId === initialTableSession?.id,
  )
  const initialBlackjackRound = game.ruleSet === "blackjack"
    ? await readActiveBlackjackRound(cookieStore, initialTableSession?.id)
    : null

  return (
    <MemberGameFrame
      initialLanguage={member.settings.language}
      memberName={member.profile.displayName}
    >
      <GameTableLoader
        ruleSet={game.ruleSet ?? "service"}
        entry={game}
        defaultLanguage={member.settings.language}
        initialWalletBalance={member.wallet.balance}
        initialProgress={initialProgress}
        initialTableSession={initialTableSession}
        initialGameRounds={initialGameRounds}
        initialBlackjackRound={initialBlackjackRound}
      />
    </MemberGameFrame>
  )
}
