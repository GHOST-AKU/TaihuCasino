import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { PlayerHomePage } from "@/components/player-home-page"
import { readMemberOverview } from "@/lib/member-data"

export default async function HomePage() {
  const cookieStore = await cookies()
  const member = await readMemberOverview(cookieStore)

  if (!member) {
    redirect(`/login?next=${encodeURIComponent("/")}`)
  }

  return (
    <PlayerHomePage
      initialLanguage={member.settings.language}
      initialMemberName={member.profile.displayName}
      initialMemberOverview={member}
    />
  )
}
