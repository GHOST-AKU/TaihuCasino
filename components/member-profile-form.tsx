"use client"

import { useState } from "react"
import { CheckCircle2, Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface EditableProfile {
  displayName: string
  avatarUrl: string
}

interface MemberProfileFormLabels {
  displayName: string
  displayNamePlaceholder: string
  avatarUrl: string
  avatarUrlPlaceholder: string
  saveProfile: string
  saved: string
  saveError: string
}

export function MemberProfileForm({
  initialProfile,
  labels = {
    displayName: "Display name",
    displayNamePlaceholder: "Demo Member",
    avatarUrl: "Avatar URL",
    avatarUrlPlaceholder: "https://...",
    saveProfile: "Save profile",
    saved: "Profile saved.",
    saveError: "Unable to save member profile.",
  },
}: {
  initialProfile: EditableProfile
  labels?: MemberProfileFormLabels
}) {
  const [displayName, setDisplayName] = useState(initialProfile.displayName)
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setMessage("")
    setError("")

    try {
      const response = await fetch("/api/member/profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          avatarUrl,
        }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? labels.saveError)
      }

      setMessage(labels.saved)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : labels.saveError)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
      <div className="grid items-start gap-x-5 gap-y-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="displayName">{labels.displayName}</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            minLength={2}
            maxLength={60}
            placeholder={labels.displayNamePlaceholder}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="avatarUrl">{labels.avatarUrl}</Label>
          <Input
            id="avatarUrl"
            type="url"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder={labels.avatarUrlPlaceholder}
          />
        </div>
      </div>

      {message ? (
        <p className="flex items-center gap-2 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={isSaving}>
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {labels.saveProfile}
      </Button>
    </form>
  )
}
