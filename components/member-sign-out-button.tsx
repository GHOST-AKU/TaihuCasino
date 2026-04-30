"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { clearMemberSession } from "@/lib/member-session"

export function MemberSignOutButton({
  label = "Sign out",
  pendingLabel = "Signing out...",
}: {
  label?: string
  pendingLabel?: string
}) {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    await clearMemberSession()
    router.replace("/login?next=/")
    router.refresh()
  }

  return (
    <Button type="button" variant="destructive" disabled={isSigningOut} onClick={handleSignOut}>
      <LogOut className="h-4 w-4" />
      {isSigningOut ? pendingLabel : label}
    </Button>
  )
}
