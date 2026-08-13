"use client"

import dynamic from "next/dynamic"

import type { BlackjackRoundView } from "@/lib/blackjack-engine"
import type { CasinoTableEntry, GameRuleSet } from "@/lib/game-catalog"
import { isRegionalGameRuleId } from "@/lib/game-rules"
import type { Language } from "@/lib/home-content"
import type { MemberGameProgress, MemberGameRound, MemberTableSession } from "@/lib/member-data"

function TableLoaderFallback() {
  return (
    <div className="game-table-shell flex min-h-[70vh] items-center justify-center bg-background px-6 text-center">
      <div>
        <div className="mx-auto h-9 w-9 animate-pulse rounded-full border-2 border-primary/30 border-t-primary" />
        <p className="mt-4 text-sm font-medium text-muted-foreground">正在准备牌桌…</p>
      </div>
    </div>
  )
}

const BaccaratTablePage = dynamic(
  () => import("@/components/baccarat-table-page").then((module) => module.BaccaratTablePage),
  { loading: TableLoaderFallback },
)

const BlackjackTablePage = dynamic(
  () => import("@/components/blackjack-table-page").then((module) => module.BlackjackTablePage),
  { loading: TableLoaderFallback },
)

const RouletteTablePage = dynamic(
  () => import("@/components/roulette-table-page").then((module) => module.RouletteTablePage),
  { loading: TableLoaderFallback },
)

const DiceTablePage = dynamic(
  () => import("@/components/dice-table-page").then((module) => module.DiceTablePage),
  { loading: TableLoaderFallback },
)

const RegionalGameTablePage = dynamic(
  () => import("@/components/regional-game-table-page").then((module) => module.RegionalGameTablePage),
  { loading: TableLoaderFallback },
)

const GameTablePage = dynamic(
  () => import("@/components/game-table-page").then((module) => module.GameTablePage),
  { loading: TableLoaderFallback },
)

export function GameTableLoader({
  ruleSet,
  entry,
  defaultLanguage,
  initialWalletBalance,
  initialProgress,
  initialTableSession,
  initialGameRounds,
  initialBlackjackRound,
}: {
  ruleSet: GameRuleSet
  entry: CasinoTableEntry
  defaultLanguage: Language
  initialWalletBalance: number
  initialProgress: MemberGameProgress | null
  initialTableSession: MemberTableSession | null
  initialGameRounds: MemberGameRound[]
  initialBlackjackRound: BlackjackRoundView | null
}) {
  const gameStateProps = {
    entry,
    defaultLanguage,
    initialWalletBalance,
    initialProgress,
  }

  if (ruleSet === "baccarat") {
    return (
      <BaccaratTablePage
        {...gameStateProps}
        initialTableSession={initialTableSession}
        initialGameRounds={initialGameRounds}
      />
    )
  }

  if (ruleSet === "blackjack") {
    return (
      <BlackjackTablePage
        {...gameStateProps}
        initialTableSession={initialTableSession}
        initialBlackjackRound={initialBlackjackRound}
        initialGameRounds={initialGameRounds}
      />
    )
  }

  if (ruleSet === "roulette") {
    return (
      <RouletteTablePage
        {...gameStateProps}
        initialTableSession={initialTableSession}
        initialGameRounds={initialGameRounds}
      />
    )
  }

  if (ruleSet === "dice") {
    return (
      <DiceTablePage
        {...gameStateProps}
        initialTableSession={initialTableSession}
        initialGameRounds={initialGameRounds}
      />
    )
  }

  if (isRegionalGameRuleId(ruleSet)) {
    return (
      <RegionalGameTablePage
        {...gameStateProps}
        initialTableSession={initialTableSession}
        initialGameRounds={initialGameRounds}
      />
    )
  }

  return <GameTablePage {...gameStateProps} />
}
