"use client"

import dynamic from "next/dynamic"
import Script from "next/script"
import { ShieldCheck } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { isCaptchaConfigured } from "@/lib/captcha-config"
import { cn } from "@/lib/utils"

export { isCaptchaConfigured }

const CaptchaDialogModal = dynamic(
  () => import("@/components/captcha-dialog-modal").then((module) => module.CaptchaDialogModal),
  { ssr: false },
)

export function CaptchaDialog({
  open,
  onOpenChange,
  token,
  onTokenChange,
  resetKey = 0,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
  onTokenChange: (token: string) => void
  resetKey?: number
  className?: string
}) {
  const [turnstileReady, setTurnstileReady] = useState(false)
  const [scriptFailed, setScriptFailed] = useState(false)
  const statusText = !isCaptchaConfigured
    ? "Security check is not configured."
    : token
      ? "Security check complete."
      : "Open the pop-up to complete the security check."

  function openCaptchaDialog() {
    setScriptFailed(false)
    onOpenChange(true)
  }

  return (
    <>
      <div className={cn("rounded-[1.2rem] border border-primary/15 bg-background/50 px-4 py-3", className)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Security check</p>
              <p className={cn("mt-1 text-xs", token ? "font-semibold text-primary" : "text-[var(--auth-soft-text)]")}>
                {statusText}
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={!isCaptchaConfigured} onClick={openCaptchaDialog}>
            {token ? "Redo check" : "Verify"}
          </Button>
        </div>
      </div>

      {open && isCaptchaConfigured ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setTurnstileReady(true)}
          onReady={() => setTurnstileReady(true)}
          onError={() => setScriptFailed(true)}
        />
      ) : null}

      {open ? (
        <CaptchaDialogModal
          open={open}
          onOpenChange={onOpenChange}
          token={token}
          onTokenChange={onTokenChange}
          resetKey={resetKey}
          turnstileReady={turnstileReady}
          scriptFailed={scriptFailed}
        />
      ) : null}
    </>
  )
}
