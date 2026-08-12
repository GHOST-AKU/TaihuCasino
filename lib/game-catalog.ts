export type CasinoCatalogKind = "game" | "member" | "utility" | "lobby" | "ui-demo"
export type CasinoCatalogStatus = "legacy" | "shell" | "migrated"
export type GameRuleSet =
  | "baccarat"
  | "blackjack"
  | "roulette"
  | "dice"
  | "fish-prawn-crab"
  | "crown-anchor"
  | "fan-tan"
  | "french-boule"
  | "service"

export interface CasinoTableEntry {
  id: string
  slug: string
  title: string
  titleZh: string
  kind: CasinoCatalogKind
  status: CasinoCatalogStatus
  targetRoute: string
  legacyRoute?: string
  legacyFile?: string
  variantOf?: string
  ruleSet?: GameRuleSet
  description: string
  descriptionZh: string
  tableTone: string
  tableToneZh: string
  defaultBet: number
  tableNotes: string[]
  tableNotesZh: string[]
  assets?: {
    css?: string[]
    js?: string[]
    images?: string[]
  }
}

export const casinoTableEntries = [
  {
    id: "baccarat-main",
    slug: "baccarat",
    title: "Baccarat Main Table",
    titleZh: "百家乐主桌",
    kind: "game",
    status: "migrated",
    targetRoute: "/games/baccarat",
    legacyRoute: "/legacy/baccarat",
    legacyFile: "baccarat.html",
    ruleSet: "baccarat",
    description: "Fast banker-versus-player action with short shoes, clean payouts and quick re-bets.",
    descriptionZh: "快节奏庄闲对局，短靴、清晰赔付，并支持快速续押。",
    tableTone: "Premium first-stop table with banker, player and tie betting.",
    tableToneZh: "适合作为第一站的高级牌桌，可下注庄家、闲家或和局。",
    defaultBet: 100,
    tableNotes: [
      "Player pays even money; banker wins pay 0.95:1 after commission; tie pays 8:1.",
      "Each hand resolves instantly so bankroll movement stays easy to read.",
      "Signed-in members keep their recent table record in the member center.",
    ],
    tableNotesZh: [
      "闲家按 1:1 赔付；庄家扣除佣金后净赔 0.95:1；和局按 8:1 赔付。",
      "每手即时结算，筹码变化会直接进入圆形历史。",
      "登录会员的最近牌局会进入会员中心。",
    ],
  },
  {
    id: "baccarat-vip",
    slug: "baccarat-vip",
    title: "Baccarat VIP Table",
    titleZh: "百家乐贵宾桌",
    kind: "game",
    status: "migrated",
    targetRoute: "/games/baccarat-vip",
    legacyRoute: "/legacy/baccarat-vip",
    legacyFile: "baccarat2.html",
    variantOf: "baccarat",
    ruleSet: "baccarat",
    description: "Higher-stakes Baccarat with a larger default chip and a calmer VIP rhythm.",
    descriptionZh: "更高下注额的百家乐桌，默认筹码更大，节奏更稳。",
    tableTone: "VIP pacing, larger wagers and the same banker-player core.",
    tableToneZh: "贵宾节奏，大额下注，核心仍是庄闲对决。",
    defaultBet: 250,
    tableNotes: [
      "Designed for members who want a bigger opening stake.",
      "Banker, player and tie remain the only active betting areas.",
    ],
    tableNotesZh: [
      "适合想直接使用更大筹码的会员。",
      "可下注区域仍为庄家、闲家和和局。",
    ],
  },
  {
    id: "blackjack-strategy",
    slug: "blackjack",
    title: "Blackjack Strategy",
    titleZh: "21点策略桌",
    kind: "game",
    status: "migrated",
    targetRoute: "/games/blackjack",
    legacyRoute: "/legacy/blackjack",
    legacyFile: "blackjack.html",
    ruleSet: "blackjack",
    description: "A hit-or-stand Blackjack table with dealer resolution and clear hand totals.",
    descriptionZh: "可补牌、停牌的 21 点牌桌，庄家结算和点数清晰展示。",
    tableTone: "Decision-led table for short tactical sessions.",
    tableToneZh: "以选择为核心的短局策略桌。",
    defaultBet: 100,
    tableNotes: [
      "Dealer draws to 17.",
      "Aces count as 11 until the hand would bust, then count as 1.",
      "Pushes return the stake.",
    ],
    tableNotesZh: [
      "庄家补牌到 17 点。",
      "A 会优先按 11 点计算，爆牌时自动降为 1 点。",
      "平局返还下注。",
    ],
  },
  {
    id: "roulette-hall",
    slug: "roulette",
    title: "Roulette Hall",
    titleZh: "轮盘大厅",
    kind: "game",
    status: "migrated",
    targetRoute: "/games/roulette",
    legacyRoute: "/legacy/roulette",
    legacyFile: "roulette.html",
    ruleSet: "roulette",
    description: "A quick-spin roulette table focused on red, black and zero outcomes.",
    descriptionZh: "快速旋转的轮盘桌，聚焦红、黑和零号结果。",
    tableTone: "Showpiece table for easy entry and visible momentum.",
    tableToneZh: "容易进入、节奏直观的秀场型桌台。",
    defaultBet: 80,
    tableNotes: [
      "Red and black pay even money.",
      "Zero is a higher-risk green bet for larger payout swings.",
    ],
    tableNotesZh: [
      "红色和黑色按 1:1 赔付。",
      "零号为绿色高风险投注，赔付波动更大。",
    ],
  },
  {
    id: "roulette-studio",
    slug: "roulette-studio",
    title: "Roulette Studio Table",
    titleZh: "轮盘快桌",
    kind: "game",
    status: "migrated",
    targetRoute: "/games/roulette-studio",
    legacyRoute: "/legacy/roulette-studio",
    legacyFile: "roulette_openui.html",
    variantOf: "roulette",
    ruleSet: "roulette",
    description: "A compact roulette studio for quick spins and smaller table sessions.",
    descriptionZh: "更紧凑的轮盘快桌，适合短时间快速下注。",
    tableTone: "Small-format roulette flow for fast color betting.",
    tableToneZh: "小桌面轮盘节奏，主打颜色下注。",
    defaultBet: 50,
    tableNotes: [
      "Keeps the same red, black and green betting model.",
      "Lower default stake makes it easier to test longer streaks.",
    ],
    tableNotesZh: [
      "沿用红、黑、绿三类下注。",
      "默认下注更低，更适合连续观察走势。",
    ],
  },
  {
    id: "dice-quick-round",
    slug: "dice",
    title: "Sic Bo",
    titleZh: "骰宝",
    kind: "game",
    status: "migrated",
    targetRoute: "/games/dice",
    legacyRoute: "/legacy/dice",
    legacyFile: "dice.html",
    ruleSet: "dice",
    description: "A three-dice Sic Bo table with big, small, odd, even and triple wagers.",
    descriptionZh: "三骰骰宝桌，可下注大、小、单、双与豹子。",
    tableTone: "A transparent three-dice table with server-authoritative outcomes and visible odds.",
    tableToneZh: "规则透明的三骰桌，结果由服务端权威生成，并展示赔率。",
    defaultBet: 60,
    tableNotes: [
      "Three dice are rolled each round.",
      "Small is 4–10 and Big is 11–17; any triple makes Big, Small, Odd and Even lose.",
    ],
    tableNotesZh: [
      "每局掷三枚骰子。",
      "4–10 点为小，11–17 点为大；任意豹子会令大、小、单、双全部落空。",
    ],
  },
  {
    id: "fish-prawn-crab",
    slug: "fish-prawn-crab",
    title: "Fish Prawn Crab",
    titleZh: "鱼虾蟹",
    kind: "game",
    status: "migrated",
    targetRoute: "/games/fish-prawn-crab",
    ruleSet: "fish-prawn-crab",
    description: "A southern Chinese symbol-dice game where one wager can match one, two or three dice.",
    descriptionZh: "源自华南地区的符号骰游戏，一个下注可命中一、二或三枚骰子。",
    tableTone: "Fast cultural table with six readable symbols and one-step settlement.",
    tableToneZh: "六种清晰符号、一步结算的地方特色快桌。",
    defaultBet: 50,
    tableNotes: [
      "Choose one or more symbols before the three dice settle.",
      "A symbol appearing once, twice or three times pays 1:1, 2:1 or 3:1 net.",
      "Virtual tokens have no cash value or redemption path.",
    ],
    tableNotesZh: [
      "三枚骰子结算前，可选择一个或多个符号下注。",
      "所押符号出现一、二、三次时，分别净赔 1:1、2:1、3:1。",
      "虚拟筹码不具现金价值，也不可兑换。",
    ],
  },
  {
    id: "crown-anchor",
    slug: "crown-anchor",
    title: "Crown & Anchor",
    titleZh: "皇冠与锚",
    kind: "game",
    status: "migrated",
    targetRoute: "/games/crown-anchor",
    ruleSet: "crown-anchor",
    description: "A British maritime symbol-dice table using crown, anchor and the four card suits.",
    descriptionZh: "英国航海传统符号骰桌，使用皇冠、船锚与四种扑克牌花色。",
    tableTone: "A compact maritime variant that shares the transparent symbol-dice model.",
    tableToneZh: "紧凑的航海主题变体，沿用透明的符号骰规则。",
    defaultBet: 50,
    tableNotes: [
      "Choose crown, anchor, heart, diamond, club or spade.",
      "One, two or three matches pay 1:1, 2:1 or 3:1 net.",
      "Every result is generated and settled on the server.",
    ],
    tableNotesZh: [
      "可选择皇冠、船锚、红心、方块、梅花或黑桃。",
      "命中一、二、三枚骰子时，分别净赔 1:1、2:1、3:1。",
      "每个结果均由服务端生成并结算。",
    ],
  },
  {
    id: "fan-tan",
    slug: "fan-tan",
    title: "Fan-Tan",
    titleZh: "番摊",
    kind: "game",
    status: "migrated",
    targetRoute: "/games/fan-tan",
    ruleSet: "fan-tan",
    description: "A classic remainder game: counters are grouped by four and the final remainder wins.",
    descriptionZh: "经典余数游戏：将筹码每四枚分组，最后的余数决定胜位。",
    tableTone: "A calm counting table built for learning probability through visible grouping.",
    tableToneZh: "通过可见分组理解概率的安静计数桌。",
    defaultBet: 40,
    tableNotes: [
      "Choose remainder 1, 2, 3 or 4.",
      "A correct selection pays 2.85:1 net after the table commission.",
      "The result snapshot records the counter total and remainder for review.",
    ],
    tableNotesZh: [
      "选择余数 1、2、3 或 4。",
      "命中后扣除桌台佣金，净赔 2.85:1。",
      "结果快照会记录筹码总数与余数，便于复核。",
    ],
  },
  {
    id: "french-boule",
    slug: "french-boule",
    title: "French Boule",
    titleZh: "法式 Boule",
    kind: "game",
    status: "migrated",
    targetRoute: "/games/french-boule",
    ruleSet: "french-boule",
    description: "A compact French wheel using numbers 1–9, simple chances and exact-number bets.",
    descriptionZh: "使用 1–9 号、简单机会与单号下注的紧凑法式轮盘。",
    tableTone: "A small educational wheel with concise odds and a clearly explained number-five edge.",
    tableToneZh: "赔率简洁的小型学习轮盘，并清晰说明 5 号的庄家优势。",
    defaultBet: 40,
    tableNotes: [
      "Red/black, odd/even and low/high pay 1:1; number 5 loses all simple-chance bets.",
      "A single number pays 7:1 net.",
      "The result comes from a server-generated 1–9 outcome.",
    ],
    tableNotesZh: [
      "红黑、单双、低高净赔 1:1；结果为 5 时，所有简单机会下注均输。",
      "单号净赔 7:1。",
      "结果由服务端生成 1–9 的权威号码。",
    ],
  },
  {
    id: "cocktail-bar",
    slug: "cocktail-bar",
    title: "Cocktail Bar",
    titleZh: "鸡尾酒吧",
    kind: "utility",
    status: "migrated",
    targetRoute: "/games/cocktail-bar",
    legacyRoute: "/legacy/cocktail-bar",
    legacyFile: "cocktail-bar.html",
    ruleSet: "service",
    description: "A lounge service table for member hospitality requests inside the casino floor.",
    descriptionZh: "娱乐场内的会员酒廊服务入口，用于处理桌边饮品需求。",
    tableTone: "Service quality loop for lounge-style casino play.",
    tableToneZh: "面向会员酒廊体验的服务质量流程。",
    defaultBet: 40,
    tableNotes: [
      "Service rounds represent lounge orders, not wagering rounds.",
      "High service scores add a small member perk; poor service removes a small credit adjustment.",
    ],
    tableNotesZh: [
      "服务局代表酒廊订单，不是下注局。",
      "高评分会增加小额会员礼遇，低评分会扣减少量体验额度。",
    ],
  },
  {
    id: "cocktail-service",
    slug: "cocktail-service",
    title: "Casino Cocktail Service",
    titleZh: "桌边鸡尾酒服务",
    kind: "utility",
    status: "migrated",
    targetRoute: "/games/cocktail-service",
    legacyRoute: "/legacy/cocktail-service",
    legacyFile: "casino-cocktail-service.html",
    ruleSet: "service",
    description: "A table-service flow for ordering and resolving member lounge requests.",
    descriptionZh: "桌边点单与会员酒廊请求的处理流程。",
    tableTone: "Operational service flow for member lounge requests.",
    tableToneZh: "用于会员服务请求的运营流程。",
    defaultBet: 40,
    tableNotes: [
      "Service quality is scored at the end of each request.",
      "This route is for casino hospitality, not a wagering game.",
    ],
    tableNotesZh: [
      "每次服务请求结束后都会给出质量评分。",
      "这是娱乐场服务入口，不是下注游戏。",
    ],
  },
] satisfies CasinoTableEntry[]

export const legacyCatalogEntries = [
  {
    id: "member-counter",
    slug: "member-counter",
    title: "Legacy Member Counter",
    titleZh: "Legacy Member Counter",
    kind: "member",
    status: "legacy",
    targetRoute: "/member",
    legacyRoute: "/legacy/member-counter",
    legacyFile: "member-counter.html",
    description: "Legacy Auth0 member counter retained as read-only migration source.",
    descriptionZh: "旧会员计数页面，仅作历史资料保留。",
    tableTone: "Legacy member utility.",
    tableToneZh: "旧会员工具。",
    defaultBet: 0,
    tableNotes: [
      "The new member experience lives in /member and /member/settings.",
      "Auth0 static assets are not used as the new implementation source of truth.",
    ],
    tableNotesZh: [
      "新的会员信息在 /member。",
      "新的设置页在 /member/settings。",
    ],
    assets: {
      css: ["assets/css/member-counter.css"],
      js: ["assets/js/member-auth-config.js", "assets/js/member-auth.js"],
    },
  },
] satisfies CasinoTableEntry[]

export const allCasinoCatalogEntries = [
  ...casinoTableEntries,
  ...legacyCatalogEntries,
] satisfies CasinoTableEntry[]

export const playableTableEntries = casinoTableEntries.filter(
  (entry) => entry.kind === "game",
)

const catalogEntryBySlug = new Map(allCasinoCatalogEntries.map((entry) => [entry.slug, entry]))
const playableTableBySlug = new Map(playableTableEntries.map((entry) => [entry.slug, entry]))

export function getCasinoCatalogEntry(slug: string) {
  return catalogEntryBySlug.get(slug)
}

export function getPlayableTable(slug: string) {
  return playableTableBySlug.get(slug)
}
