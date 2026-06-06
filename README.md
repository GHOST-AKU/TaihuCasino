# TaihuCasino

## Overview / 项目概览

TaihuCasino is now organized as a formal `React + Next.js` product line while still keeping a legacy static runtime layer during migration.

TaihuCasino 目前已经整理为以 `React + Next.js` 为正式主线、同时保留遗留静态运行层用于迁移过渡的前端项目。

This restructure did two main things:

这次整理主要完成了两件事：

- absorbed the former Next.js app into the repository root as the formal product structure  
  将原有的 Next.js 应用吸收到仓库根目录，作为正式产品结构
- archived former static homepage explorations under `prototypes/`  
  将历史静态首页探索稿归档到 `prototypes/`
- kept the existing legacy runtime in `pages/` and `assets/` so current game content can continue to run during migration  
  保留 `pages/` 与 `assets/` 中的遗留运行层，以便现有游戏内容在迁移过程中继续可用

## Tech Stack / 技术栈

- `React 19`
- `Next.js 16`
- `TypeScript`
- `Tailwind CSS 4`

## Delivery Hub / 协作入口

- Project board / 项目看板: [TaihuCasino Delivery](https://github.com/users/GHOST-AKU/projects/2)
- Wiki / 流程与手册入口: [TaihuCasino Wiki](https://github.com/GHOST-AKU/TaihuCasino/wiki)
- Wiki source in repo / 仓库内 Wiki 源文件: [`docs/wiki/Home.md`](./docs/wiki/Home.md)
- Backlog bootstrap issues / 首批 backlog: [Open backlog items](https://github.com/GHOST-AKU/TaihuCasino/issues?q=is%3Aissue%20is%3Aopen%20no%3Aassignee)

## Main Directories / 主要目录

```text
.
|-- app/                  # Formal Next.js App Router pages / 正式 Next.js App Router 页面
|-- components/           # Shared React components / 共享 React 组件
|-- hooks/                # Shared hooks / 共享 hooks
|-- lib/                  # Shared utilities and helpers / 共享工具函数与辅助逻辑
|-- pages/                # Legacy static runtime pages / 遗留静态运行页面
|-- assets/               # Assets for legacy runtime / 遗留运行层资源
|-- public/               # Static assets for formal app / 正式应用静态资源
|-- styles/               # Formal style resources / 正式样式资源
|-- prototypes/           # Archived prototype references / 已归档原型参考
|-- docs/                 # Project documentation / 项目文档
|-- package.json
`-- README.md
```

## Prototypes / 原型目录说明

Archived prototype files are kept under:

已归档的原型文件保留在：

- `prototypes/legacy-static/`
- `prototypes/vercel-ver-static/`

These directories are for reference only. They should not become the main line for new product work.

这些目录仅用于参考，不应再作为新产品开发的主线。

## Development / 开发方式

1. Install dependencies / 安装依赖

```bash
pnpm install
```

2. Start development server / 启动开发环境

```bash
pnpm dev
```

3. Production build / 生产构建

```bash
pnpm build
pnpm start
```

## Development Rules / 开发约定

- New product pages should go to `app/`.  
  新的产品页面应放在 `app/`。
- Shared UI and route shells should go to `components/`.  
  共享 UI 与路由骨架应放在 `components/`。
- New production work should not continue to accumulate in legacy static HTML files.  
  新的正式产品工作不应继续堆积在遗留静态 HTML 文件中。
- Legacy pages in `pages/` may still be maintained temporarily, but the long-term direction is migration into Next.js.  
  `pages/` 中的遗留页面可以临时维护，但长期方向仍是迁移进 Next.js。

## Related Documents / 相关文档

- `docs/PROJECT_STRUCTURE.md`
- `docs/PROJECT_STRUCTURE_CLEAN.md`
- `docs/TECH_STACK_DECISION.md`
- `docs/THEME_SYSTEM.md`
- `docs/CODEBASE_BOUNDARY_PLAN.md`

## License / 许可证

- `LICENSE`
- `Surreal Chaos License v0.1.md`

## Authentication Environment

The formal product line uses Supabase Auth for member identity and SSR cookie sessions.

正式产品线使用 Supabase Auth 作为会员身份来源，并使用 SSR cookie session。

Production deployments should configure:

生产环境应配置：

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL. / Supabase 项目 URL。
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as a compatibility fallback. / Supabase publishable key。`NEXT_PUBLIC_SUPABASE_ANON_KEY` 可作为兼容回退。
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service role key used by member and wallet mutation paths. Never expose it through `NEXT_PUBLIC_*`. / 仅服务端使用的 Supabase service role key，用于会员和钱包写入路径。绝不能通过 `NEXT_PUBLIC_*` 暴露。
- `TAIHU_SESSION_SECRET`: a long random secret used to sign fallback session cookies. / 用于签名回退 session cookie 的长随机密钥。
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: required when registration remains enabled with Cloudflare Turnstile. / 如果注册页继续启用 Cloudflare Turnstile，则需要配置。

Supabase Auth production setup also needs Site URL, `/auth/callback` redirect allowlist, OAuth provider configuration, and CAPTCHA/Turnstile backend settings when registration is enabled. See `docs/DEPLOYMENT_READINESS.md`.

Supabase Auth 生产设置还需要配置 Site URL、`/auth/callback` redirect allowlist、OAuth provider，以及启用注册时的 CAPTCHA/Turnstile 后台设置。详见 `docs/DEPLOYMENT_READINESS.md`。

The app keeps a legacy local fallback for development when Supabase variables are absent:

- `TAIHU_AUTH_ACCOUNT` and `TAIHU_AUTH_PASSWORD`: single-account fallback credentials. / 单个回退账号。
- `TAIHU_AUTH_USERS`: JSON array of fallback user records, for example `[{"account":"member@example.com","password":"change-me","displayName":"Member"}]`. / 回退用户 JSON 数组，例如 `[{"account":"member@example.com","password":"change-me","displayName":"Member"}]`。

Local development falls back to `demo@taihu.casino` / `taihu-demo-2026` when neither Supabase nor fallback auth env vars are set. Production deployments should configure Supabase Auth and should not rely on the fallback account.

当 Supabase 和回退账号变量都不存在时，本地开发会回退到 `demo@taihu.casino` / `taihu-demo-2026`。生产部署必须配置 Supabase Auth，不应依赖回退账号。

Supabase profile schema, RLS notes, and member data boundary live in `docs/SUPABASE_AUTH_SCHEMA.md`. The initial SQL migration is `supabase/migrations/20260418_init_auth_profiles.sql`.

Supabase profile schema、RLS 说明和会员数据边界见 `docs/SUPABASE_AUTH_SCHEMA.md`。初始 SQL migration 是 `supabase/migrations/20260418_init_auth_profiles.sql`。

## Temporary Test Branch Scope

This branch keeps legacy static files as read-only fallback material while moving the playable experience into the App Router.

- Migrated React routes: `/games/baccarat`, `/games/baccarat-vip`, `/games/blackjack`, `/games/roulette`, `/games/roulette-studio`, `/games/dice`, `/games/cocktail-bar`, `/games/cocktail-service`.
- Legacy fallback routes: `/legacy/[slug]`, backed by the unified table catalog in `lib/game-catalog.ts`.
- Member routes: `/member`, `/member/settings`, and `/settings` as a redirect.
- Member APIs: `/api/member/me`, `/api/member/profile`, `/api/member/settings`, `/api/member/progress`.
- Supabase migrations: `20260418_init_auth_profiles.sql` plus `20260418_member_data.sql` for settings, wallet, progress, and events.

Run the test gate before opening a PR:

```bash
pnpm typecheck
pnpm build
```
