export type Language = "zh" | "en"
export type ViewerMode = "guest" | "member"
export type StatTrend = "up" | "down" | "neutral"

export const LANGUAGE_STORAGE_KEY = "taihu-home-language"
export const VIEWER_MODE_STORAGE_KEY = "taihu-home-viewer-mode"

export interface CoreGame {
  slug: "baccarat" | "blackjack" | "roulette" | "dice"
  title: string
  titleZh: string
  subtitle: Record<Language, string>
  players: number
  rating: number
  trend: string
  badge: Record<Language, string>
  legacyFile: string
}

export interface HomeStatItem {
  key: string
  label: string
  value: string
  subtext: string
  trend: StatTrend
}

export interface HomeActionItem {
  key: string
  label: string
  description: string
  href: string
  variant?: "default" | "primary"
}

export interface HomeLiveItem {
  name: string
  avatar?: string
  game: string
  amount: string
}

export interface HomeActivityItem {
  game: string
  result: string
  amount: string
  time: string
  positive: boolean
}

const avatarBase = "https://images.unsplash.com/"

export const coreGames: CoreGame[] = [
  {
    slug: "baccarat",
    title: "Baccarat",
    titleZh: "百家乐",
    subtitle: {
      zh: "经典庄闲对决，适合作为第一张主推桌台。",
      en: "Classic banker vs player table for a premium first stop.",
    },
    players: 1247,
    rating: 4.9,
    trend: "+12%",
    badge: { zh: "热门桌台", en: "Featured" },
    legacyFile: "baccarat.html",
  },
  {
    slug: "blackjack",
    title: "Blackjack",
    titleZh: "21点",
    subtitle: {
      zh: "策略感更强的高频桌游，适合连续游玩。",
      en: "A fast strategy table built around momentum and decisions.",
    },
    players: 892,
    rating: 4.8,
    trend: "+8%",
    badge: { zh: "策略推荐", en: "Strategy" },
    legacyFile: "blackjack.html",
  },
  {
    slug: "roulette",
    title: "Roulette",
    titleZh: "轮盘",
    subtitle: {
      zh: "更有秀场感的核心入口，适合新玩家快速进入。",
      en: "A showpiece table that is easy to enter and fun to watch.",
    },
    players: 756,
    rating: 4.8,
    trend: "+10%",
    badge: { zh: "新手友好", en: "Easy Start" },
    legacyFile: "roulette.html",
  },
  {
    slug: "dice",
    title: "Dice",
    titleZh: "骰子",
    subtitle: {
      zh: "短局切换快，适合轻量试玩与快节奏游玩。",
      en: "Quick rounds for lightweight sessions and rapid table switching.",
    },
    players: 421,
    rating: 4.6,
    trend: "+5%",
    badge: { zh: "快节奏", en: "Quick Round" },
    legacyFile: "dice.html",
  },
]

export function getLegacyGameRoute(slug: CoreGame["slug"]) {
  return `/legacy/${slug}`
}

export function getGameRoute(slug: CoreGame["slug"], language: Language) {
  return `/games/${slug}?lang=${language}`
}

export function getCoreGame(slug: string) {
  return coreGames.find((game) => game.slug === slug)
}

export function getGameLinks(language: Language) {
  return coreGames.map((game, index) => ({
    ...game,
    href: getGameRoute(game.slug, language),
    featured: index === 0,
  }))
}

export function getNavItems(language: Language) {
  return language === "zh"
    ? [
        { label: "游戏大厅", href: "#games", active: true },
        { label: "一周输赢榜", href: "#leaderboard" },
        { label: "最近记录", href: "#history" },
      ]
    : [
        { label: "Lobby", href: "#games", active: true },
        { label: "Weekly P&L", href: "#leaderboard" },
        { label: "History", href: "#history" },
      ]
}

export function getStats(language: Language, viewerMode: ViewerMode): HomeStatItem[] {
  if (viewerMode === "member") {
    return language === "zh"
      ? [
          { key: "balance", label: "账户余额", value: "$24,850", subtext: "今日净赢 +$1,250", trend: "up" },
          { key: "rate", label: "胜率", value: "67%", subtext: "高于 85% 玩家", trend: "up" },
          { key: "recent", label: "最近游玩", value: "48 局", subtext: "本周已完成", trend: "neutral" },
          { key: "streak", label: "连胜记录", value: "7 局", subtext: "距离个人最好还差 5 局", trend: "up" },
        ]
      : [
          { key: "balance", label: "Balance", value: "$24,850", subtext: "+$1,250 today", trend: "up" },
          { key: "rate", label: "Win Rate", value: "67%", subtext: "Above 85% of players", trend: "up" },
          { key: "recent", label: "Recent Sessions", value: "48", subtext: "Completed this week", trend: "neutral" },
          { key: "streak", label: "Streak", value: "7 wins", subtext: "Five away from personal best", trend: "up" },
        ]
  }

  return language === "zh"
    ? [
        { key: "games", label: "核心桌游", value: "4", subtext: "已接入主入口", trend: "neutral" },
        { key: "players", label: "在线玩家", value: "3,316", subtext: "大厅热度持续上升", trend: "up" },
        { key: "tables", label: "推荐桌台", value: "12", subtext: "适合游客即刻试玩", trend: "up" },
        { key: "events", label: "今日活动", value: "3", subtext: "首充、签到与 VIP 指引", trend: "neutral" },
      ]
    : [
        { key: "games", label: "Core Games", value: "4", subtext: "Connected to the new lobby", trend: "neutral" },
        { key: "players", label: "Players Online", value: "3,316", subtext: "Traffic keeps climbing", trend: "up" },
        { key: "tables", label: "Featured Tables", value: "12", subtext: "Ready for first-time players", trend: "up" },
        { key: "events", label: "Today Events", value: "3", subtext: "Bonus, check-in and VIP guidance", trend: "neutral" },
      ]
}

export function getQuickActions(language: Language, viewerMode: ViewerMode): HomeActionItem[] {
  if (viewerMode === "member") {
    return language === "zh"
      ? [
          { key: "continue", label: "继续百家乐", description: "回到你最近常玩的主桌", href: getGameRoute("baccarat", language), variant: "primary" },
          { key: "roulette", label: "切到轮盘", description: "去热度上升中的新手友好桌台", href: getGameRoute("roulette", language) },
          { key: "history", label: "查看最近记录", description: "浏览最近几次游玩的结果摘要", href: "#history" },
          { key: "vip", label: "VIP 指引", description: "查看会员等级、奖励和活动提示", href: "#leaderboard" },
        ]
      : [
          { key: "continue", label: "Resume Baccarat", description: "Jump back to your most-played table", href: getGameRoute("baccarat", language), variant: "primary" },
          { key: "roulette", label: "Open Roulette", description: "Visit the rising beginner-friendly table", href: getGameRoute("roulette", language) },
          { key: "history", label: "Recent Sessions", description: "Review your latest session summaries", href: "#history" },
          { key: "vip", label: "VIP Guide", description: "Check rewards, status and current perks", href: "#leaderboard" },
        ]
  }

  return language === "zh"
    ? [
        { key: "start", label: "开始试玩", description: "从百家乐或轮盘开始进入大厅", href: getGameRoute("baccarat", language), variant: "primary" },
        { key: "blackjack", label: "试试 21 点", description: "给喜欢策略感的玩家准备的桌台", href: getGameRoute("blackjack", language) },
        { key: "register", label: "创建玩家档案", description: "预留后续接入注册与会员能力", href: "#top" },
        { key: "guide", label: "了解玩法", description: "先看推荐与最近动态，再选择桌台", href: "#leaderboard" },
      ]
    : [
        { key: "start", label: "Start Playing", description: "Begin with Baccarat or Roulette", href: getGameRoute("baccarat", language), variant: "primary" },
        { key: "blackjack", label: "Try Blackjack", description: "A stronger strategy pick for new players", href: getGameRoute("blackjack", language) },
        { key: "register", label: "Create Profile", description: "Reserved for future sign-up and member flow", href: "#top" },
        { key: "guide", label: "How To Start", description: "Check recommendations before choosing a table", href: "#leaderboard" },
      ]
}

export function getLivePlayers(language: Language): HomeLiveItem[] {
  return language === "zh"
    ? [
        { name: "Sarah M.", avatar: `${avatarBase}photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop&crop=face`, game: "百家乐主桌", amount: "+$2,450" },
        { name: "James L.", avatar: `${avatarBase}photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face`, game: "21 点策略桌", amount: "+$890" },
        { name: "Emily R.", avatar: `${avatarBase}photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face`, game: "轮盘大厅", amount: "+$1,620" },
        { name: "Michael K.", avatar: `${avatarBase}photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&crop=face`, game: "百家乐 VIP 桌", amount: "+$1,100" },
        { name: "Lisa W.", avatar: `${avatarBase}photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop&crop=face`, game: "骰子快局", amount: "+$680" },
      ]
    : [
        { name: "Sarah M.", avatar: `${avatarBase}photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop&crop=face`, game: "Baccarat Main Table", amount: "+$2,450" },
        { name: "James L.", avatar: `${avatarBase}photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face`, game: "Blackjack Strategy", amount: "+$890" },
        { name: "Emily R.", avatar: `${avatarBase}photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face`, game: "Roulette Hall", amount: "+$1,620" },
        { name: "Michael K.", avatar: `${avatarBase}photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&crop=face`, game: "Baccarat VIP", amount: "+$1,100" },
        { name: "Lisa W.", avatar: `${avatarBase}photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop&crop=face`, game: "Dice Quick Round", amount: "+$680" },
      ]
}

export function getRecentActivities(language: Language, viewerMode: ViewerMode): HomeActivityItem[] {
  if (viewerMode === "member") {
    return language === "zh"
      ? [
          { game: "Baccarat", result: "赢", amount: "+$450", time: "2 小时前", positive: true },
          { game: "Blackjack", result: "赢", amount: "+$120", time: "3 小时前", positive: true },
          { game: "Roulette", result: "负", amount: "-$80", time: "5 小时前", positive: false },
          { game: "Dice", result: "赢", amount: "+$210", time: "昨天", positive: true },
        ]
      : [
          { game: "Baccarat", result: "Won", amount: "+$450", time: "2 hours ago", positive: true },
          { game: "Blackjack", result: "Won", amount: "+$120", time: "3 hours ago", positive: true },
          { game: "Roulette", result: "Lost", amount: "-$80", time: "5 hours ago", positive: false },
          { game: "Dice", result: "Won", amount: "+$210", time: "Yesterday", positive: true },
        ]
  }

  return language === "zh"
    ? [
        { game: "Baccarat", result: "推荐", amount: "高热度", time: "现在可进入", positive: true },
        { game: "Roulette", result: "推荐", amount: "易上手", time: "适合首局", positive: true },
        { game: "Blackjack", result: "策略向", amount: "中高难度", time: "建议第二站", positive: false },
        { game: "Dice", result: "快节奏", amount: "短局玩法", time: "适合试玩", positive: true },
      ]
    : [
        { game: "Baccarat", result: "Featured", amount: "High Traffic", time: "Open now", positive: true },
        { game: "Roulette", result: "Featured", amount: "Easy Start", time: "Best first table", positive: true },
        { game: "Blackjack", result: "Strategy", amount: "Mid to high skill", time: "Try it second", positive: false },
        { game: "Dice", result: "Quick", amount: "Short rounds", time: "Great for trials", positive: true },
      ]
}

export function getHomeCopy(language: Language, viewerMode: ViewerMode) {
  const isMember = viewerMode === "member"

  return {
    brand: "TaihuCasino",
    playerName: isMember ? "Alex Chen" : language === "zh" ? "游客玩家" : "Guest Player",
    profileLabel: isMember ? "VIP Member" : language === "zh" ? "Guest Mode" : "Guest Mode",
    labels: {
      gamesHeading: language === "zh" ? "核心桌游" : "Core Games",
      gamesSubheading: language === "zh" ? "玩家主页面" : "Player Home",
      gamesViewAll: language === "zh" ? "查看记录" : "View activity",
      quickActions: language === "zh" ? "推荐动作" : "Recommended Actions",
      liveWins: language === "zh" ? "一周输赢榜" : "Weekly P&L",
      liveBadge: language === "zh" ? "近 7 天" : "7 days",
      history: language === "zh" ? "最近记录" : "Recent Activity",
      historyViewAll: language === "zh" ? "返回顶部" : "Back to top",
      footerTagline: language === "zh" ? "TaihuCasino · 会员游戏大厅" : "TaihuCasino · Member game lobby",
      terms: language === "zh" ? "条款" : "Terms",
      privacy: language === "zh" ? "隐私" : "Privacy",
      support: language === "zh" ? "支持" : "Support",
      responsibleGaming: language === "zh" ? "理性游戏" : "Responsible Gaming",
      search: language === "zh" ? "搜索" : "Search",
      notifications: language === "zh" ? "通知" : "Notifications",
      settings: language === "zh" ? "设置" : "Settings",
      menu: language === "zh" ? "菜单" : "Menu",
      language: language === "zh" ? "语言" : "Language",
      viewerMode: language === "zh" ? "视角" : "Viewer",
      guest: language === "zh" ? "游客" : "Guest",
      member: language === "zh" ? "玩家" : "Member",
      cardCta: language === "zh" ? "进入桌台" : "Enter table",
    },
    hero: isMember
      ? {
          eyebrow: language === "zh" ? "玩家主页面" : "Player Home",
          title: language === "zh" ? "欢迎回来，Alex" : "Welcome back, Alex",
          description:
            language === "zh"
              ? "从这里继续你的主要桌游路线，先进入百家乐，再根据热度切去轮盘、21 点或骰子快局。"
              : "Resume your main table flow here, then branch into Roulette, Blackjack or Dice as traffic shifts.",
          primaryCta: language === "zh" ? "继续百家乐" : "Resume Baccarat",
          primaryHref: getGameRoute("baccarat", language),
          secondaryCta: language === "zh" ? "打开轮盘" : "Open Roulette",
          secondaryHref: getGameRoute("roulette", language),
          highlights:
            language === "zh"
              ? [
                  { label: "最近常玩", value: "百家乐主桌" },
                  { label: "最佳节奏", value: "轮盘 + 骰子切换" },
                  { label: "推荐下一步", value: "21 点策略桌" },
                ]
              : [
                  { label: "Recent Table", value: "Baccarat Main" },
                  { label: "Best Flow", value: "Roulette + Dice" },
                  { label: "Next Pick", value: "Blackjack Strategy" },
                ],
        }
      : {
          eyebrow: language === "zh" ? "玩家游玩主页面" : "Player Entry",
          title: language === "zh" ? "进入 TaihuCasino 游戏大厅" : "Enter the TaihuCasino Lobby",
          description:
            language === "zh"
              ? "先从四个核心桌游里选一个开始。首页会给你推荐顺序、热门桌台和最近动态，帮助游客快速进入状态。"
              : "Start with one of the four core tables. The home page guides new players with traffic, recommendations and quick routes.",
          primaryCta: language === "zh" ? "开始百家乐" : "Start Baccarat",
          primaryHref: getGameRoute("baccarat", language),
          secondaryCta: language === "zh" ? "试试轮盘" : "Try Roulette",
          secondaryHref: getGameRoute("roulette", language),
          highlights:
            language === "zh"
              ? [
                  { label: "首推入口", value: "百家乐" },
                  { label: "新手友好", value: "轮盘" },
                  { label: "快节奏试玩", value: "骰子" },
                ]
              : [
                  { label: "First Pick", value: "Baccarat" },
                  { label: "Easy Start", value: "Roulette" },
                  { label: "Fast Trial", value: "Dice" },
                ],
        },
  }
}
