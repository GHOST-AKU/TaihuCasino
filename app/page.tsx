import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { PlayerHomePage } from "@/components/player-home-page"
import { readMemberLobbyOverview, toMemberHomeSnapshot } from "@/lib/member-data"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const cookieStore = await cookies()
  const member = await readMemberLobbyOverview(cookieStore)

  if (!member) {
    redirect(`/login?next=${encodeURIComponent("/")}`)
  }

  return (
    <PlayerHomePage
      initialLanguage={member.settings.language}
      initialMemberName={member.profile.displayName}
      initialMemberOverview={toMemberHomeSnapshot(member)}
    />
  )
}
