"use client"

import Link from "next/link"
import { ArrowLeft, Mail } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { CaptchaDialog } from "@/components/captcha-dialog"
import { PasswordRecoveryShell } from "@/components/password-recovery-shell"
import { Button } from "@/components/ui/button"
import { requestPasswordReset } from "@/lib/member-session"

export function ForgotPasswordForm({ invalidLink = false }: { invalidLink?: boolean }) {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState(invalidLink ? "That reset link is invalid or has expired. Request a new one." : "")
  const [isComplete, setIsComplete] = useState(false)
  const [captchaToken, setCaptchaToken] = useState("")
  const [captchaDialogOpen, setCaptchaDialogOpen] = useState(false)
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const formRef = useRef<HTMLFormElement | null>(null)
  const submitAfterCaptchaRef = useRef(false)

  useEffect(() => {
    if (!captchaToken || !submitAfterCaptchaRef.current) {
      return
    }

    submitAfterCaptchaRef.current = false
    setCaptchaDialogOpen(false)
    formRef.current?.requestSubmit()
  }, [captchaToken])

  function resetCaptcha() {
    setCaptchaToken("")
    setCaptchaResetKey((current) => current + 1)
    setCaptchaDialogOpen(true)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage("")

    if (!captchaToken) {
      setErrorMessage("Complete the security check in the pop-up to continue.")
      submitAfterCaptchaRef.current = true
      setCaptchaDialogOpen(true)
      return
    }

    setIsSubmitting(true)

    try {
      await requestPasswordReset(email.trim(), captchaToken)
      setIsComplete(true)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start password recovery.")
      resetCaptcha()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <PasswordRecoveryShell
        title={isComplete ? "Check your email" : "Recover access"}
        description={isComplete ? "Use the secure link we sent to continue." : "Enter the email address linked to your member account."}
      >
      {isComplete ? (
        <div className="space-y-6 text-center">
          <div className="rounded-[1.25rem] border border-primary/20 bg-primary/10 px-5 py-4 text-sm leading-6 text-[var(--auth-soft-text)]">
            If an account exists for <strong className="text-foreground">{email.trim()}</strong>, a reset link is on its way. Check spam if it does not arrive.
          </div>
          <Button asChild className="h-12 w-full rounded-[1.1rem] text-base">
            <Link href="/login">Return to sign in</Link>
          </Button>
        </div>
      ) : (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
          <label htmlFor="recovery-email" className="block">
            <span className="mb-2.5 block text-sm font-semibold text-foreground">Email address</span>
            <span className="casino-auth-field flex h-14 items-center rounded-[1.25rem] border px-4 focus-within:border-primary/35">
              <Mail className="mr-3 h-5 w-5 text-[var(--auth-faint-text)]" />
              <input
                id="recovery-email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="h-full w-full bg-transparent text-base text-foreground outline-none placeholder:text-[var(--auth-faint-text)]"
              />
            </span>
          </label>

          <CaptchaDialog
            open={captchaDialogOpen}
            onOpenChange={setCaptchaDialogOpen}
            token={captchaToken}
            onTokenChange={setCaptchaToken}
            resetKey={captchaResetKey}
          />

          {errorMessage ? <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage}</p> : null}

          <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-[1.1rem] text-base">
            {isSubmitting ? "Sending secure link..." : "Send reset link"}
          </Button>

          <Link href="/login" className="flex items-center justify-center gap-2 text-sm font-semibold text-primary hover:text-primary/80">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </form>
      )}
      </PasswordRecoveryShell>
    </>
  )
}
