"use client"

import Link from "next/link"
import { CheckCircle2, Eye, EyeOff, Lock } from "lucide-react"
import { useState } from "react"

import { PasswordRecoveryShell } from "@/components/password-recovery-shell"
import { Button } from "@/components/ui/button"
import { updateMemberPassword } from "@/lib/member-session"

export function ResetPasswordForm() {
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isComplete, setIsComplete] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.")
      return
    }
    if (password !== confirmation) {
      setErrorMessage("Passwords do not match.")
      return
    }

    setErrorMessage("")
    setIsSubmitting(true)
    try {
      await updateMemberPassword(password)
      setIsComplete(true)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update your password.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PasswordRecoveryShell
      title={isComplete ? "Password updated" : "Set a new password"}
      description={isComplete ? "Your recovery session has been closed securely." : "Choose at least 8 characters that you do not reuse elsewhere."}
    >
      {isComplete ? (
        <div className="space-y-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <Button asChild className="h-12 w-full rounded-[1.1rem] text-base">
            <Link href="/login">Sign in with new password</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {[
            { id: "new-password", label: "New password", value: password, setter: setPassword },
            { id: "confirm-password", label: "Confirm new password", value: confirmation, setter: setConfirmation },
          ].map((field) => (
            <div key={field.id}>
              <label htmlFor={field.id} className="mb-2.5 block text-sm font-semibold text-foreground">{field.label}</label>
              <span className="casino-auth-field flex h-14 items-center rounded-[1.25rem] border px-4 focus-within:border-primary/35">
                <Lock className="mr-3 h-5 w-5 text-[var(--auth-faint-text)]" />
                <input
                  id={field.id}
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={field.value}
                  onChange={(event) => field.setter(event.target.value)}
                  className="h-full w-full bg-transparent text-base text-foreground outline-none"
                />
                <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide passwords" : "Show passwords"} className="ml-3 text-[var(--auth-faint-text)] hover:text-foreground">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
            </div>
          ))}

          {errorMessage ? <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage}</p> : null}

          <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-[1.1rem] text-base">
            {isSubmitting ? "Updating password..." : "Update password"}
          </Button>
          <Link href="/forgot-password" className="block text-center text-sm font-semibold text-primary hover:text-primary/80">Request a new link</Link>
        </form>
      )}
    </PasswordRecoveryShell>
  )
}
