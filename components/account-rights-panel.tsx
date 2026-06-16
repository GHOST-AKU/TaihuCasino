"use client"

import { useEffect, useState } from "react"
import { Download, Loader2, ShieldAlert, Trash2, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ACCOUNT_DELETION_CONFIRMATION } from "@/lib/legal"

interface DeletionRequest {
  id: string
  status: string
  requested_at: string
  confirmed_at?: string | null
}

export function AccountRightsPanel() {
  const [request, setRequest] = useState<DeletionRequest | null>(null)
  const [confirmation, setConfirmation] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/member/account-deletion", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setRequest(payload.request ?? null))
      .catch(() => null)
  }, [])

  async function update(action: "request" | "confirm" | "cancel") {
    setLoading(true)
    setMessage("")
    setError("")
    try {
      const response = await fetch("/api/member/account-deletion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, confirmation }),
      })
      const payload = await response.json().catch(() => null) as { request?: DeletionRequest; error?: string } | null
      if (!response.ok) throw new Error(payload?.error ?? "Unable to update deletion request.")
      setRequest(action === "cancel" ? null : payload?.request ?? null)
      setConfirmation("")
      setMessage(
        action === "confirm"
          ? "Deletion request confirmed and queued for retention and operator review. The account has not been deleted yet."
          : action === "cancel"
            ? "Deletion request canceled."
            : "Deletion request created. Confirm it below after reviewing the consequences.",
      )
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update deletion request.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/60 bg-background/60 p-5">
        <div className="flex items-start gap-3">
          <Download className="mt-1 h-5 w-5 text-primary" />
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Export my data / 导出我的数据</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Downloads a private, non-cached JSON export containing your profile, settings, virtual wallet, game history, consents, and account-rights requests.</p>
            <Button asChild variant="outline" className="mt-4">
              <a href="/api/member/data-export" download>Download JSON export / 下载 JSON</a>
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-1 h-5 w-5 text-destructive" />
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Account deletion request / 账户删除申请</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">This is a two-stage request. Confirmation queues the account for retention and operator review; it does not immediately erase data.</p>
            {!request ? (
              <Button variant="destructive" className="mt-4" disabled={loading} onClick={() => update("request")}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Start deletion request / 发起删除申请
              </Button>
            ) : request.status === "requested" ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">Type <strong className="text-foreground">{ACCOUNT_DELETION_CONFIRMATION}</strong> after signing in recently and closing active table sessions.</p>
                <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={ACCOUNT_DELETION_CONFIRMATION} />
                <div className="flex flex-wrap gap-3">
                  <Button variant="destructive" disabled={loading || confirmation !== ACCOUNT_DELETION_CONFIRMATION} onClick={() => update("confirm")}>Confirm deletion request</Button>
                  <Button variant="outline" disabled={loading} onClick={() => update("cancel")}><XCircle className="h-4 w-4" /> Cancel request</Button>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">Confirmed and awaiting retention/operator review. Your account is still active until the reviewed execution step is implemented.</p>
            )}
          </div>
        </div>
      </div>
      {message ? <p className="text-sm text-primary">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
