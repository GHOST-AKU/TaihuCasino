"use client"

import { RotateCcw } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { isCaptchaConfigured, turnstileSiteKey } from "@/lib/captcha-config"

type CaptchaStatus = "idle" | "loading" | "verified" | "expired" | "error"

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      appearance: "always"
      theme: "light"
      size: "normal"
      callback: (token: string) => void
      "expired-callback": () => void
      "error-callback": () => void
    },
  ) => string
  getResponse?: (widgetId?: string) => string
  reset: (widgetId?: string) => void
  remove?: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

function getTurnstile() {
  return window.turnstile
}

export function CaptchaDialogModal({
  open,
  onOpenChange,
  token,
  onTokenChange,
  resetKey,
  turnstileReady,
  scriptFailed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
  onTokenChange: (token: string) => void
  resetKey: number
  turnstileReady: boolean
  scriptFailed: boolean
}) {
  const [captchaStatus, setCaptchaStatus] = useState<CaptchaStatus>(
    isCaptchaConfigured ? (token ? "verified" : "loading") : "error",
  )
  const [turnstileContainer, setTurnstileContainer] = useState<HTMLDivElement | null>(null)
  const turnstileWidgetIdRef = useRef<string | null>(null)
  const acceptedTokenRef = useRef("")

  const acceptToken = useCallback(
    (rawToken: string) => {
      const nextToken = rawToken.trim()
      if (!nextToken || acceptedTokenRef.current === nextToken) {
        return
      }

      acceptedTokenRef.current = nextToken
      setCaptchaStatus("verified")
      onTokenChange(nextToken)
    },
    [onTokenChange],
  )

  const readCaptchaTokenFromWidget = useCallback(() => {
    const widgetResponse = turnstileWidgetIdRef.current
      ? (getTurnstile()?.getResponse?.(turnstileWidgetIdRef.current)?.trim() ?? "")
      : ""

    if (widgetResponse) {
      return widgetResponse
    }

    return (
      turnstileContainer
        ?.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')
        ?.value.trim() ?? ""
    )
  }, [turnstileContainer])

  const resetCaptcha = useCallback(() => {
    acceptedTokenRef.current = ""
    onTokenChange("")
    setCaptchaStatus(isCaptchaConfigured ? "loading" : "error")
    getTurnstile()?.reset(turnstileWidgetIdRef.current ?? undefined)
  }, [onTokenChange])

  useEffect(() => {
    if (scriptFailed || !isCaptchaConfigured) {
      setCaptchaStatus("error")
      return
    }

    if (token) {
      setCaptchaStatus("verified")
      return
    }

    acceptedTokenRef.current = ""
    setCaptchaStatus(open ? "loading" : "idle")
  }, [open, scriptFailed, token])

  useEffect(() => {
    if (resetKey === 0) {
      return
    }

    resetCaptcha()
  }, [resetKey, resetCaptcha])

  useEffect(() => {
    const turnstile = getTurnstile()
    if (!open || !isCaptchaConfigured || scriptFailed) {
      return
    }

    if (!turnstileContainer || !turnstile) {
      setCaptchaStatus("loading")
      return
    }

    setCaptchaStatus("loading")
    turnstileWidgetIdRef.current = turnstile.render(turnstileContainer, {
      sitekey: turnstileSiteKey,
      appearance: "always",
      theme: "light",
      size: "normal",
      callback: acceptToken,
      "expired-callback"() {
        acceptedTokenRef.current = ""
        onTokenChange("")
        setCaptchaStatus("expired")
      },
      "error-callback"() {
        acceptedTokenRef.current = ""
        onTokenChange("")
        setCaptchaStatus("error")
      },
    })

    return () => {
      if (turnstileWidgetIdRef.current) {
        getTurnstile()?.remove?.(turnstileWidgetIdRef.current)
      }
      turnstileWidgetIdRef.current = null
    }
  }, [acceptToken, onTokenChange, open, scriptFailed, turnstileContainer, turnstileReady])

  useEffect(() => {
    if (!open || token) {
      return
    }

    const tokenCheck = window.setInterval(() => {
      const activeCaptchaToken = readCaptchaTokenFromWidget()
      if (activeCaptchaToken) {
        acceptToken(activeCaptchaToken)
        window.clearInterval(tokenCheck)
      }
    }, 500)

    return () => window.clearInterval(tokenCheck)
  }, [acceptToken, open, readCaptchaTokenFromWidget, token])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[25rem] rounded-[1.35rem] border-primary/15">
        <DialogHeader>
          <DialogTitle>Security check</DialogTitle>
          <DialogDescription>Complete the verification in this pop-up before continuing.</DialogDescription>
        </DialogHeader>

        {isCaptchaConfigured ? (
          <div className="space-y-3">
            <div className="flex min-h-[76px] items-center justify-center rounded-[1rem] border border-primary/10 bg-background/60 px-2 py-3">
              <div ref={setTurnstileContainer} className="min-h-[65px]" />
            </div>
            {captchaStatus === "loading" ? (
              <p className="text-xs font-medium text-[var(--auth-soft-text)]">Loading security check...</p>
            ) : null}
            {captchaStatus === "verified" ? (
              <p className="text-xs font-semibold text-primary">Security check complete.</p>
            ) : null}
            {captchaStatus === "expired" || captchaStatus === "error" ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2">
                <p className="text-xs font-medium text-destructive">
                  {captchaStatus === "expired" ? "Security check expired." : "Security check failed."}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Security check is not configured.
          </p>
        )}

        <DialogFooter>
          {isCaptchaConfigured ? (
            <Button type="button" variant="outline" onClick={resetCaptcha} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Retry
            </Button>
          ) : null}
          <DialogClose asChild>
            <Button
              type="button"
              variant={captchaStatus === "verified" ? "default" : "outline"}
              disabled={isCaptchaConfigured && captchaStatus !== "verified"}
            >
              Done
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
