"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { LANGUAGE_STORAGE_KEY } from "@/lib/home-content"

type MemberTheme = "light" | "dark" | "system"
type MemberLanguage = "zh" | "en"
type ProfileVisibility = "private" | "friends" | "public"
type TableDensity = "comfortable" | "compact"

interface EditableSettings {
  theme: MemberTheme
  language: MemberLanguage
  soundEnabled: boolean
  notificationEnabled: boolean
  marketingOptIn: boolean
  profileVisibility: ProfileVisibility
  quickBetAmount: number
  tableDensity: TableDensity
  responsibleLimit: number
}

function getFormCopy(language: MemberLanguage) {
  const isChinese = language === "zh"

  return {
    theme: isChinese ? "主题" : "Theme",
    language: isChinese ? "语言" : "Language",
    profileVisibility: isChinese ? "资料可见范围" : "Profile visibility",
    tableDensity: isChinese ? "桌台密度" : "Table density",
    quickBetAmount: isChinese ? "快捷下注金额" : "Quick bet amount",
    responsibleLimit: isChinese ? "责任游玩限额" : "Responsible play limit",
    sound: isChinese ? "声音" : "Sound",
    soundDescription: isChinese ? "播放桌台与结算音效。" : "Play table and settlement sounds.",
    notifications: isChinese ? "通知" : "Notifications",
    notificationsDescription: isChinese ? "显示账户和桌台提醒。" : "Show account and table alerts.",
    marketing: isChinese ? "营销消息" : "Marketing",
    marketingDescription: isChinese ? "允许接收活动与优惠更新。" : "Allow promotional updates.",
    saving: isChinese ? "正在自动保存..." : "Auto-saving...",
    saved: isChinese ? "设置已自动保存，并已在会员站点生效。" : "Settings auto-saved and now apply across the member site.",
    saveError: isChinese ? "无法保存设置。" : "Unable to save settings.",
    testWallet: isChinese ? "测试钱包" : "Test wallet",
    testWalletDescription: isChinese
      ? "仅用于本地和测试环境，充值会写入真实钱包流水。"
      : "Local and test environments only. Top-ups are written to the real wallet ledger.",
    testWalletBalance: isChinese ? "当前余额" : "Current balance",
    testWalletAmount: isChinese ? "充值金额" : "Top-up amount",
    testWalletAction: isChinese ? "充值测试钱包" : "Top up test wallet",
    testWalletPending: isChinese ? "正在充值..." : "Topping up...",
    testWalletSuccess: isChinese ? "测试钱包已充值。" : "Test wallet topped up.",
    testWalletError: isChinese ? "无法充值测试钱包。" : "Unable to top up test wallet.",
    options: {
      dark: isChinese ? "深色" : "Dark",
      light: isChinese ? "浅色" : "Light",
      system: isChinese ? "跟随系统" : "System",
      zh: isChinese ? "中文" : "Chinese",
      en: isChinese ? "英文" : "English",
      private: isChinese ? "仅自己" : "Private",
      friends: isChinese ? "好友可见" : "Friends",
      public: isChinese ? "公开" : "Public",
      comfortable: isChinese ? "舒适" : "Comfortable",
      compact: isChinese ? "紧凑" : "Compact",
    },
  }
}

function formatMoney(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  })
}

export function MemberSettingsForm({
  initialSettings,
  initialWalletBalance,
  enableTestWalletTopUp,
}: {
  initialSettings: EditableSettings
  initialWalletBalance: number
  enableTestWalletTopUp: boolean
}) {
  const { setTheme } = useTheme()
  const router = useRouter()
  const [settings, setSettings] = useState(initialSettings)
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance)
  const [topUpAmount, setTopUpAmount] = useState(1000)
  const [isToppingUp, setIsToppingUp] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState(getFormCopy(initialSettings.language).saved)
  const [error, setError] = useState("")
  const saveSequence = useRef(0)
  const copy = getFormCopy(settings.language)

  useEffect(() => {
    setTheme(initialSettings.theme)
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, initialSettings.language)
  }, [initialSettings.language, initialSettings.theme, setTheme])

  useEffect(() => {
    setWalletBalance(initialWalletBalance)
  }, [initialWalletBalance])

  async function persistSettings(nextSettings: EditableSettings) {
    const currentSave = saveSequence.current + 1
    saveSequence.current = currentSave
    setIsSaving(true)
    setMessage("")
    setError("")

    try {
      const response = await fetch("/api/member/settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(nextSettings),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string; settings?: EditableSettings } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? getFormCopy(nextSettings.language).saveError)
      }

      if (saveSequence.current === currentSave) {
        setSettings(payload?.settings ?? nextSettings)
        setMessage(getFormCopy(nextSettings.language).saved)
        router.refresh()
      }
    } catch (saveError) {
      if (saveSequence.current === currentSave) {
        setError(saveError instanceof Error ? saveError.message : getFormCopy(nextSettings.language).saveError)
      }
    } finally {
      if (saveSequence.current === currentSave) {
        setIsSaving(false)
      }
    }
  }

  function updateSetting<K extends keyof EditableSettings>(key: K, value: EditableSettings[K]) {
    const nextSettings = {
      ...settings,
      [key]: value,
    }

    setSettings(nextSettings)

    if (key === "theme") {
      setTheme(value as MemberTheme)
    }

    if (key === "language") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value as MemberLanguage)
    }

    void persistSettings(nextSettings)
  }

  function updateNumberSetting(key: "quickBetAmount" | "responsibleLimit", value: string) {
    updateSetting(key, Number(value) as EditableSettings[typeof key])
  }

  async function topUpTestWallet(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const amount = Math.min(100000, Math.max(1, Math.round(Number(topUpAmount) * 100) / 100))

    setIsToppingUp(true)
    setMessage("")
    setError("")

    try {
      const response = await fetch("/api/member/wallet/test-topup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount,
          idempotencyKey: `settings-test-topup-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        }),
      })
      const payload = (await response.json().catch(() => null)) as {
        error?: string
        walletEntry?: {
          balanceAfter?: number
        }
      } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? copy.testWalletError)
      }

      if (typeof payload?.walletEntry?.balanceAfter === "number") {
        setWalletBalance(payload.walletEntry.balanceAfter)
      }

      const memberResponse = await fetch("/api/member/me", {
        headers: {
          "cache-control": "no-store",
        },
      }).catch(() => null)
      const memberPayload = memberResponse?.ok
        ? ((await memberResponse.json().catch(() => null)) as { member?: { wallet?: { balance?: unknown } } } | null)
        : null

      if (typeof memberPayload?.member?.wallet?.balance === "number") {
        setWalletBalance(memberPayload.member.wallet.balance)
      }

      setMessage(copy.testWalletSuccess)
      router.refresh()
    } catch (topUpError) {
      setError(topUpError instanceof Error ? topUpError.message : copy.testWalletError)
    } finally {
      setIsToppingUp(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{copy.theme}</Label>
          <Select value={settings.theme} onValueChange={(value) => updateSetting("theme", value as MemberTheme)}>
            <SelectTrigger className="w-full">
              <span className="truncate">{copy.options[settings.theme]}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">{copy.options.dark}</SelectItem>
              <SelectItem value="light">{copy.options.light}</SelectItem>
              <SelectItem value="system">{copy.options.system}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{copy.language}</Label>
          <Select value={settings.language} onValueChange={(value) => updateSetting("language", value as MemberLanguage)}>
            <SelectTrigger className="w-full">
              <span className="truncate">{copy.options[settings.language]}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zh">{copy.options.zh}</SelectItem>
              <SelectItem value="en">{copy.options.en}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{copy.profileVisibility}</Label>
          <Select
            value={settings.profileVisibility}
            onValueChange={(value) => updateSetting("profileVisibility", value as ProfileVisibility)}
          >
            <SelectTrigger className="w-full">
              <span className="truncate">{copy.options[settings.profileVisibility]}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">{copy.options.private}</SelectItem>
              <SelectItem value="friends">{copy.options.friends}</SelectItem>
              <SelectItem value="public">{copy.options.public}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{copy.tableDensity}</Label>
          <Select
            value={settings.tableDensity}
            onValueChange={(value) => updateSetting("tableDensity", value as TableDensity)}
          >
            <SelectTrigger className="w-full">
              <span className="truncate">{copy.options[settings.tableDensity]}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comfortable">{copy.options.comfortable}</SelectItem>
              <SelectItem value="compact">{copy.options.compact}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quickBetAmount">{copy.quickBetAmount}</Label>
          <Input
            id="quickBetAmount"
            type="number"
            min={10}
            max={5000}
            value={settings.quickBetAmount}
            onChange={(event) => updateNumberSetting("quickBetAmount", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="responsibleLimit">{copy.responsibleLimit}</Label>
          <Input
            id="responsibleLimit"
            type="number"
            min={100}
            max={100000}
            value={settings.responsibleLimit}
            onChange={(event) => updateNumberSetting("responsibleLimit", event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SettingSwitch
          label={copy.sound}
          description={copy.soundDescription}
          checked={settings.soundEnabled}
          onCheckedChange={(checked) => updateSetting("soundEnabled", checked)}
        />
        <SettingSwitch
          label={copy.notifications}
          description={copy.notificationsDescription}
          checked={settings.notificationEnabled}
          onCheckedChange={(checked) => updateSetting("notificationEnabled", checked)}
        />
        <SettingSwitch
          label={copy.marketing}
          description={copy.marketingDescription}
          checked={settings.marketingOptIn}
          onCheckedChange={(checked) => updateSetting("marketingOptIn", checked)}
        />
      </div>

      {enableTestWalletTopUp ? (
        <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{copy.testWallet}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{copy.testWalletDescription}</p>
              <p className="mt-3 text-sm text-foreground">
                {copy.testWalletBalance} <span className="font-semibold">{formatMoney(walletBalance)}</span>
              </p>
            </div>
            <form
              action="/api/member/wallet/test-topup"
              method="post"
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={topUpTestWallet}
            >
              <div className="space-y-2">
                <Label htmlFor="testWalletTopUpAmount">{copy.testWalletAmount}</Label>
                <Input
                  id="testWalletTopUpAmount"
                  name="amount"
                  type="number"
                  min={1}
                  max={100000}
                  step="0.01"
                  value={topUpAmount}
                  onChange={(event) => setTopUpAmount(Number(event.target.value))}
                />
              </div>
              <Button type="submit" disabled={isToppingUp}>
                {isToppingUp ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {copy.testWalletPending}
                  </>
                ) : (
                  copy.testWalletAction
                )}
              </Button>
            </form>
          </div>
          {!isToppingUp && message === copy.testWalletSuccess ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-primary" aria-live="polite">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </p>
          ) : null}
        </div>
      ) : null}

      {isSaving ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {copy.saving}
        </p>
      ) : null}
      {!isSaving && message && message !== copy.testWalletSuccess ? (
        <p className="flex items-center gap-2 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function SettingSwitch({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex min-h-28 items-start justify-between gap-4 rounded-2xl border border-border/50 bg-background/60 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  )
}
