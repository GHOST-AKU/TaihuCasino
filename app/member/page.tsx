import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { CalendarClock, CircleDollarSign, Gamepad2, ShieldCheck, Trophy, UserRound } from "lucide-react"

import { MemberCenterShell } from "@/components/member-center-shell"
import { MemberProfileForm } from "@/components/member-profile-form"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ThemePanelSurface } from "@/components/theme-page-shell"
import { readMemberOverview } from "@/lib/member-data"
import { getPlayableTable, playableTableEntries } from "@/lib/game-catalog"
import type { MemberLanguage, ProgressOutcome, ProfileVisibility } from "@/lib/member-data"
import { formatAmount } from "@/lib/number-format"

const memberDateFormatters: Record<MemberLanguage, Intl.DateTimeFormat> = {
  zh: new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }),
  en: new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }),
}

function formatDate(value: string | null, language: MemberLanguage) {
  if (!value) {
    return language === "zh" ? "暂无活动" : "No activity yet"
  }

  return memberDateFormatters[language].format(new Date(value))
}

function formatMoney(value: number) {
  return `$${formatAmount(value)}`
}

function visibilityText(value: ProfileVisibility, language: MemberLanguage) {
  if (language === "en") {
    return value
  }

  return value === "public" ? "公开" : value === "friends" ? "好友可见" : "私密"
}

function providerText(value: string | null | undefined, language: MemberLanguage) {
  if (language === "en") {
    return value ?? "local"
  }

  return value === "supabase" ? "已验证" : "本地"
}

function tierText(value: string, language: MemberLanguage) {
  if (language === "en") {
    return value
  }

  return value === "Test Member" ? "测试会员" : value === "Verified Member" ? "认证会员" : value
}

function outcomeText(value: ProgressOutcome | null, language: MemberLanguage) {
  if (language === "en") {
    return value ?? "new"
  }

  if (value === "win") {
    return "赢"
  }

  if (value === "loss") {
    return "输"
  }

  if (value === "push") {
    return "和"
  }

  return "新局"
}

function gameTitle(slug: string, language: MemberLanguage) {
  const table = getPlayableTable(slug)

  return language === "zh" ? table?.titleZh ?? slug : table?.title ?? slug
}

export default async function MemberPage() {
  const cookieStore = await cookies()
  const member = await readMemberOverview(cookieStore)

  if (!member) {
    redirect(`/login?next=${encodeURIComponent("/member")}`)
  }

  const initials = member.profile.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  const topProgress = member.progress[0]
  const availableTables = playableTableEntries.filter((table) => table.kind === "game")
  const language = member.settings.language
  const isChinese = language === "zh"

  return (
    <MemberCenterShell
      title={isChinese ? "会员资料" : "Member info"}
      subtitle={
        isChinese
          ? "账户、钱包、最近牌桌记录与可编辑个人资料。"
          : "Account, wallet, recent table record and editable profile details."
      }
      active="profile"
      labels={{
        backToLobby: isChinese ? "返回大厅" : "Back to lobby",
        eyebrow: isChinese ? "TAIHUCASINO 会员中心" : "TaihuCasino Member Center",
        profile: isChinese ? "会员资料" : "Member info",
        settings: isChinese ? "设置" : "Settings",
      }}
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <ThemePanelSurface className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              <AvatarImage src={member.profile.avatarUrl} alt={member.profile.displayName} />
              <AvatarFallback className="bg-primary/15 text-2xl text-primary">{initials || "TC"}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge>{tierText(member.profile.tier, language)}</Badge>
                <Badge variant="outline">{providerText(member.profile.provider, language)}</Badge>
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-foreground">{member.profile.displayName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{member.profile.account}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <InfoTile icon={CalendarClock} label={isChinese ? "登录时间" : "Signed in"} value={formatDate(member.profile.loginAt, language)} />
            <InfoTile icon={ShieldCheck} label={isChinese ? "资料可见性" : "Visibility"} value={visibilityText(member.settings.profileVisibility, language)} />
            <InfoTile icon={CircleDollarSign} label={isChinese ? "钱包余额" : "Wallet balance"} value={formatMoney(member.wallet.balance)} />
            <InfoTile icon={Trophy} label={isChinese ? "奖励余额" : "Bonus balance"} value={formatMoney(member.wallet.bonusBalance)} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/member/settings">{isChinese ? "打开设置" : "Open settings"}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/games/baccarat">{isChinese ? "继续百家乐" : "Resume Baccarat"}</Link>
            </Button>
          </div>
        </ThemePanelSurface>

        <ThemePanelSurface className="p-6">
          <div className="mb-5 flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{isChinese ? "编辑资料" : "Editable profile"}</h2>
          </div>
          <MemberProfileForm
            initialProfile={member.profile}
            labels={{
              displayName: isChinese ? "显示名称" : "Display name",
              displayNamePlaceholder: isChinese ? "演示会员" : "Demo Member",
              avatarUrl: isChinese ? "头像链接" : "Avatar URL",
              avatarUrlPlaceholder: "https://...",
              saveProfile: isChinese ? "保存资料" : "Save profile",
              saved: isChinese ? "资料已保存。" : "Profile saved.",
              saveError: isChinese ? "无法保存会员资料。" : "Unable to save member profile.",
            }}
          />
        </ThemePanelSurface>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <ThemePanelSurface className="p-6">
          <div className="mb-5 flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{isChinese ? "最近牌桌记录" : "Recent table record"}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {member.progress.length > 0 ? (
              member.progress.map((progress) => (
                <div key={progress.gameSlug} className="rounded-2xl border border-border/50 bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{gameTitle(progress.gameSlug, language)}</p>
                    <Badge variant={progress.lastResult === "win" ? "default" : progress.lastResult === "loss" ? "destructive" : "outline"}>
                      {outcomeText(progress.lastResult, language)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">{progress.wins}/{progress.plays}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{progress.lastSummary || (isChinese ? "暂无摘要" : "No summary yet")}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {isChinese ? "最后游玩" : "Last played"} {formatDate(progress.lastPlayedAt, language)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground sm:col-span-2">
                {isChinese
                  ? "还没有保存的会员牌局。登录后游玩任意牌桌，这里会自动显示记录。"
                  : "No saved member rounds yet. Play any table while signed in and this panel will fill in."}
              </div>
            )}
          </div>
        </ThemePanelSurface>

        <ThemePanelSurface className="p-6">
          <h2 className="text-lg font-semibold text-foreground">{isChinese ? "牌桌状态" : "Table status"}</h2>
          <div className="mt-5 space-y-3">
            <InfoRow label={isChinese ? "可用牌桌" : "Available tables"} value={`${availableTables.length}`} />
            <InfoRow label={isChinese ? "最佳连胜" : "Best streak"} value={`${topProgress?.bestStreak ?? 0}`} />
            <InfoRow label={isChinese ? "快捷下注" : "Quick bet"} value={formatMoney(member.settings.quickBetAmount)} />
            <InfoRow label={isChinese ? "责任限额" : "Responsible limit"} value={formatMoney(member.settings.responsibleLimit)} />
          </div>
          <div className="mt-5 grid gap-2">
            {availableTables.slice(0, 4).map((table) => (
              <Button key={table.slug} asChild variant="outline" className="justify-between">
                <Link href={table.targetRoute}>
                  {isChinese ? table.titleZh : table.title}
                  <Gamepad2 className="h-4 w-4" />
                </Link>
              </Button>
            ))}
          </div>
        </ThemePanelSurface>
      </div>
    </MemberCenterShell>
  )
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/60 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}
