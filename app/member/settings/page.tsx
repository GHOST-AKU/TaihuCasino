import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Bell, Eye, Gamepad2, LockKeyhole, Settings } from "lucide-react"

import { MemberCenterShell } from "@/components/member-center-shell"
import { MemberSettingsForm } from "@/components/member-settings-form"
import { MemberSignOutButton } from "@/components/member-sign-out-button"
import { AccountRightsPanel } from "@/components/account-rights-panel"
import { Button } from "@/components/ui/button"
import { ThemePanelSurface } from "@/components/theme-page-shell"
import { readMemberOverview } from "@/lib/member-data"
import type { MemberLanguage, MemberSettings } from "@/lib/member-data"

function getSettingsCopy(language: MemberLanguage) {
  const isChinese = language === "zh"

  return {
    shell: {
      title: isChinese ? "设置" : "Settings",
      subtitle: isChinese ? "管理会员偏好、隐私选项和桌台默认值。" : "Manage member preferences, privacy options and table defaults.",
      labels: {
        backToLobby: isChinese ? "返回大厅" : "Back to lobby",
        eyebrow: isChinese ? "TaihuCasino 会员中心" : "TaihuCasino Member Center",
        profile: isChinese ? "会员资料" : "Member info",
        settings: isChinese ? "设置" : "Settings",
      },
    },
    preferences: isChinese ? "偏好设置" : "Preferences",
    policy: isChinese ? "当前策略" : "Current policy",
    safety: isChinese ? "安全操作" : "Safety actions",
    safetyDescription: isChinese
      ? "使用这些控制项离开当前会话。删除账户和解绑第三方登录需要单独的安全确认流程。"
      : "Use these controls to leave the current session. Account deletion and provider unlinking require a separate security confirmation flow.",
    backToMember: isChinese ? "返回会员资料" : "Back to member info",
    signOut: isChinese ? "退出登录" : "Sign out",
    signingOut: isChinese ? "正在退出..." : "Signing out...",
    summary: {
      visibility: isChinese ? "可见范围" : "Visibility",
      notifications: isChinese ? "通知" : "Notifications",
      tableDensity: isChinese ? "桌台密度" : "Table density",
      dailyLimit: isChinese ? "每日游玩限额" : "Daily play limit",
      on: isChinese ? "开启" : "On",
      off: isChinese ? "关闭" : "Off",
      values: {
        private: isChinese ? "仅自己" : "private",
        friends: isChinese ? "好友可见" : "friends",
        public: isChinese ? "公开" : "public",
        comfortable: isChinese ? "舒适" : "comfortable",
        compact: isChinese ? "紧凑" : "compact",
      },
    },
  }
}

function formatSettingValue(settings: MemberSettings, key: "profileVisibility" | "tableDensity", language: MemberLanguage) {
  const copy = getSettingsCopy(language).summary.values
  return copy[settings[key]]
}

export default async function MemberSettingsPage() {
  const cookieStore = await cookies()
  const member = await readMemberOverview(cookieStore)

  if (!member) {
    redirect(`/login?next=${encodeURIComponent("/member/settings")}`)
  }

  const copy = getSettingsCopy(member.settings.language)

  return (
    <MemberCenterShell
      title={copy.shell.title}
      subtitle={copy.shell.subtitle}
      active="settings"
      labels={copy.shell.labels}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
        <ThemePanelSurface className="p-6">
          <div className="mb-5 flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{copy.preferences}</h2>
          </div>
          <MemberSettingsForm
            initialSettings={member.settings}
            initialWalletBalance={member.wallet.balance}
            enableTestWalletTopUp={process.env.NODE_ENV !== "production" || process.env.TAIHU_ENABLE_TEST_WALLET_TOPUP === "true"}
          />
        </ThemePanelSurface>

        <aside className="space-y-6">
          <ThemePanelSurface className="p-6">
            <h2 className="text-lg font-semibold text-foreground">{copy.policy}</h2>
            <div className="mt-5 grid gap-3">
              <SettingSummary icon={Eye} label={copy.summary.visibility} value={formatSettingValue(member.settings, "profileVisibility", member.settings.language)} />
              <SettingSummary icon={Bell} label={copy.summary.notifications} value={member.settings.notificationEnabled ? copy.summary.on : copy.summary.off} />
              <SettingSummary icon={Gamepad2} label={copy.summary.tableDensity} value={formatSettingValue(member.settings, "tableDensity", member.settings.language)} />
              <SettingSummary icon={LockKeyhole} label={copy.summary.dailyLimit} value={`$${member.settings.responsibleLimit.toLocaleString()}`} />
            </div>
          </ThemePanelSurface>

          <ThemePanelSurface className="p-6">
            <h2 className="text-lg font-semibold text-foreground">{copy.safety}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {copy.safetyDescription}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/member">{copy.backToMember}</Link>
              </Button>
              <MemberSignOutButton label={copy.signOut} pendingLabel={copy.signingOut} />
            </div>
          </ThemePanelSurface>
        </aside>
      </div>
      <ThemePanelSurface className="mt-6 p-6">
        <h2 className="mb-5 text-lg font-semibold text-foreground">Account rights / 账户权利</h2>
        <AccountRightsPanel />
      </ThemePanelSurface>
    </MemberCenterShell>
  )
}

function SettingSummary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bell
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-background/60 p-4">
      <div className="rounded-xl bg-primary/15 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">{value}</p>
      </div>
    </div>
  )
}
