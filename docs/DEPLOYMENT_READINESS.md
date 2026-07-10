# Deployment Readiness / 部署就绪说明

Last updated: 2026-06-17

## Scope / 范围

This document covers the MVP deployment gate for the Next.js product line. It does not cover new gameplay, new monetization features, or a Three.js lobby redesign.

本文档覆盖 Next.js 产品线的 MVP 部署检查口径。不包含新玩法、新付费功能或 Three.js 大厅重设计。

## Local Commands / 本地命令

Use Corepack so the repository-pinned `pnpm` version is used.

使用 Corepack，确保本地使用仓库指定的 `pnpm` 版本。

```powershell
corepack pnpm install
corepack pnpm typecheck
corepack pnpm build
corepack pnpm dev
```

The combined CI gate is available as:

组合 CI 检查命令：

```powershell
corepack pnpm run ci
```

`pnpm typecheck` runs `next typegen` before `tsc --noEmit -p tsconfig.typecheck.json`. This refreshes Next.js route and layout type definitions while keeping the deploy-readiness check focused on `.next/types` instead of stale `.next/dev` output from a previous dev server. The base `tsconfig.json` also excludes `.next/dev` so production builds are not affected by old dev-server type artifacts.

`pnpm typecheck` 会先执行 `next typegen`，再执行 `tsc --noEmit -p tsconfig.typecheck.json`。这样可以刷新 Next.js 路由和布局类型，同时让部署检查只关注 `.next/types`，避免旧 dev server 生成的 `.next/dev` 类型产物干扰。基础 `tsconfig.json` 也排除了 `.next/dev`，防止生产构建被旧开发产物影响。

## Build Determinism / 构建确定性

The root layout does not import fonts from `next/font/google`. Font families are defined as CSS font stacks in `app/globals.css`, so `next build` does not require network access to Google Fonts.

根布局不再从 `next/font/google` 导入字体。字体由 `app/globals.css` 中的 CSS fallback 栈提供，因此 `next build` 不再依赖 Google Fonts 网络请求。

For MVP deploy readiness, this branch accepts possible visual fallback from Inter or Playfair Display to system fonts. If brand typography fidelity becomes a launch requirement, self-host `.woff2` font files and use `next/font/local` or `@font-face` in a separate visual polish branch.

在 MVP 部署就绪阶段，本分支接受 Inter 或 Playfair Display 缺失时回退到系统字体的视觉差异。如果上线前需要严格保持品牌字体效果，应在单独的视觉打磨分支中自托管 `.woff2` 字体，并使用 `next/font/local` 或 `@font-face`。

## Node.js Runtime / Node.js 运行时

CI currently runs with Node.js 24. Use Node.js 24 for local verification and non-Vercel hosting parity.

当前 CI 使用 Node.js 24。为了和 CI 以及非 Vercel 托管环境保持一致，本地验证和生产托管建议使用 Node.js 24。

## Production Environment Variables / 生产环境变量

Required for Supabase-backed production auth and member APIs:

Supabase 生产认证和会员 API 必需变量：

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL. / Supabase 项目 URL。
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as a compatibility fallback. / Supabase publishable key。`NEXT_PUBLIC_SUPABASE_ANON_KEY` 可作为兼容回退。
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key used only by server-side member and wallet mutation paths. Never expose it to the browser. / Supabase service role key，仅用于服务端会员和钱包写入路径，绝不能暴露到浏览器。
- `TAIHU_RATE_LIMIT_SECRET`: Independent high-entropy HMAC secret used to hash client and account identifiers for shared API rate limits. Rotate it deliberately; rotation starts fresh buckets. Never expose it to the browser. / 用于共享 API 限流客户端与账户标识 HMAC 哈希的独立高熵密钥。轮换会开启新的限流桶，必须有计划地执行，绝不能暴露到浏览器。
- `TAIHU_SESSION_SECRET`: long random secret for signing fallback member session cookies. Configure it in production so legacy/fallback cookie paths cannot fail open or use development defaults. / 用于签名回退会员 session cookie 的长随机密钥。生产环境必须配置，避免 legacy/fallback cookie 路径使用开发默认值或异常。

Optional dedicated observability secret:

可选的专用可观测性密钥：

- `TAIHU_OBSERVABILITY_SECRET`: high-entropy server-only HMAC secret for pseudonymous user, session, and table identifiers in structured logs. If unset, the observer falls back to `TAIHU_RATE_LIMIT_SECRET` or `TAIHU_SESSION_SECRET`; when none is available in production, those hashes are omitted. Rotate deliberately because rotation changes correlation hashes. / 用于结构化日志中用户、session 与桌台伪匿名标识的服务端高熵 HMAC 密钥。未配置时会回退到 `TAIHU_RATE_LIMIT_SECRET` 或 `TAIHU_SESSION_SECRET`；生产环境三者都不存在时将省略这些哈希。轮换会改变关联哈希，必须有计划地执行。

Required when login, registration, or password recovery uses Cloudflare Turnstile:

登录、注册或密码找回启用 Cloudflare Turnstile 时，还需要：

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: Turnstile site key used by the login, registration, and password-recovery forms. / 登录、注册和密码找回表单使用的 Turnstile site key。

Development-only fallback auth:

仅限本地开发的回退账号：

- `TAIHU_AUTH_ACCOUNT` and `TAIHU_AUTH_PASSWORD`: one fallback account. / 单个回退账号。
- `TAIHU_AUTH_USERS`: JSON array of fallback users, for example `[{"account":"member@example.com","password":"change-me","displayName":"Member"}]`. / 回退用户 JSON 数组，例如 `[{"account":"member@example.com","password":"change-me","displayName":"Member"}]`。

Optional development/testing switch:

可选开发/测试开关：

- `TAIHU_ENABLE_TEST_WALLET_TOPUP`: enables the test wallet top-up endpoint in production only when explicitly set to `true`. Keep it unset or false for normal production deployments. / 仅在显式设置为 `true` 时允许生产环境测试充值入口。常规生产部署应保持未设置或 false。
- `TAIHU_ENABLE_STUB_CREDITING`: enables stub purchase and ad-reward crediting in production only when explicitly set to `true`. Keep it unset or false for real production; verified receipt, signed webhook, or ad-provider proof must use a separate trusted path. / 仅在显式设置为 `true` 时允许生产环境 Stub 购买与广告奖励入账。真实生产环境应保持未设置或 false；经验证的收据、签名 webhook 或广告供应商证明必须使用独立可信路径。

Authoritative wagering boundary:

- Core-game clients submit only a table session, idempotency key, and canonical bet intent. The server generates results with `node:crypto.randomInt`, calculates payouts from fixed rules, and records the audit snapshots. Client `delta`, `outcome`, result, bankroll, and cash-out chip-balance fields are ignored or unavailable. Apply `20260610160000_authoritative_settlement_boundary.sql` before production promotion to enforce the atomic stake check and revoke direct player writes to progress/events. / 核心游戏客户端仅提交桌台会话、幂等键和规范化下注意图。服务端使用 `node:crypto.randomInt` 生成结果、按固定规则计算赔付并记录审计快照。客户端无法提交最终 `delta`、`outcome`、结果、余额或 cash-out 筹码余额。生产发布前必须应用 `20260610160000_authoritative_settlement_boundary.sql`，以启用原子下注校验并撤销玩家对 progress/events 的直接写权限。
- P0 single-round gate: dice, roulette, and baccarat clients must consume the canonical `round: RoundEnvelope<TResult>` returned by `/api/member/game-rounds`. They may animate previews, but must not update final result, chip balance, round delta, statistics, or history before the server response. The legacy `progress`, `settlement`, and top-level `idempotent` fields remain temporary compatibility fields for one release cycle. / P0 单一回合门禁：骰子、轮盘、百家乐客户端必须消费 `/api/member/game-rounds` 返回的 canonical `round: RoundEnvelope<TResult>`。它们可以播放预览动画，但在服务端响应前不得更新最终结果、筹码余额、本轮盈亏、统计或历史。旧的 `progress`、`settlement` 和顶层 `idempotent` 字段仅作为一个发布周期的临时兼容字段保留。
- Browser storage gate: core tables may store only stake and chip-denomination preferences in `localStorage`; bankroll, final result, history, and cumulative statistics must recover from server/member round history. / 浏览器存储门禁：核心桌台只能在 `localStorage` 保存下注额与筹码面额偏好；余额、最终结果、历史和累计统计必须从服务端/会员回合历史恢复。
- Release remains `NO-GO` after PR1. Server-authoritative multi-step blackjack is PR2 and must land before the P0 parent issue can close or MVP-R2 can be released. / PR1 后发布仍为 `NO-GO`。多步服务端权威 21 点属于 PR2，必须落地后才可关闭 P0 父 Issue 或发布 MVP-R2。

When Supabase variables are missing, local development can use the built-in demo account or the `TAIHU_AUTH_*` fallback. Production deployments should configure Supabase and should not rely on demo or fallback credentials.

当 Supabase 变量缺失时，本地开发可以使用内置 demo 账号或 `TAIHU_AUTH_*` 回退账号。生产部署必须配置 Supabase，不应依赖 demo 或回退账号。

## Supabase Auth Production Checklist / Supabase Auth 生产配置清单

Environment variables alone are not enough. Before promoting a production deployment, configure Supabase Auth and provider settings.

仅配置环境变量还不够。生产发布前，还需要配置 Supabase Auth 和第三方登录提供商。

- Set the Supabase Auth Site URL to the production origin. / 将 Supabase Auth Site URL 设置为生产域名。
- Add the production `/auth/callback` URL to the redirect allowlist. Add preview URLs if preview OAuth testing is required. / 将生产环境 `/auth/callback` 加入 redirect allowlist。如需在预览环境测试 OAuth，也加入预览 URL。
- Configure a production SMTP provider before enabling password recovery. The built-in trial sender is rate-limited and best-effort. / 启用密码找回前配置生产 SMTP；内置试用发信服务有严格限额且不保证送达。
- Configure the Supabase **Reset Password** email template to use `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>`. This token-hash endpoint supports links opened on a different device from the original request. / 将 Supabase **Reset Password** 邮件模板配置为上述链接；`token_hash` 确认端点支持在不同于申请设备的浏览器中打开链接。
- Verify a successful reset and an expired-link retry on every deployed hostname. Reset emails return to `/auth/callback?next=%2Freset-password`, and the request response intentionally does not reveal whether an email is registered. / 在每个部署域名验证成功重置与过期链接重试。重置邮件会回到 `/auth/callback?next=%2Freset-password`，申请结果不会透露邮箱是否已注册。
- Configure OAuth providers used by the login page: Google, Apple, Microsoft/Azure, Facebook, and X. Amazon is explicitly out of scope. / 配置登录页使用的 OAuth provider：Google、Apple、Microsoft/Azure、Facebook 和 X。Amazon 已明确排除在支持范围之外。
- Configure Supabase CAPTCHA/Turnstile backend settings for every protected auth flow in addition to `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Login, registration, and password-recovery APIs pass `captchaToken` to Supabase Auth. / 除 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 外，还要为所有受保护的认证流程配置 Supabase CAPTCHA/Turnstile 后台设置。登录、注册和密码找回 API 都会把 `captchaToken` 传给 Supabase Auth。
- Apply the Supabase migrations in `supabase/migrations/` before testing member, wallet, table session, ad reward, purchase, and game round APIs. / 在测试会员、钱包、桌台 session、广告奖励、购买和游戏回合 API 前，先应用 `supabase/migrations/` 中的迁移。
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. It is required by server-side member and wallet mutation code paths, but must never be exposed in `NEXT_PUBLIC_*` variables. / `SUPABASE_SERVICE_ROLE_KEY` 必须只存在于服务端环境。服务端会员和钱包写入路径需要它，但绝不能放进 `NEXT_PUBLIC_*` 变量。
- Apply `20260612090000_api_abuse_protection.sql` before enabling production traffic. The application-level limiter uses a service-role-only atomic Postgres RPC and fails closed for sensitive production mutations if the limiter is unavailable. / 启用生产流量前必须应用 `20260612090000_api_abuse_protection.sql`。应用级限流使用仅限 service role 的 Postgres 原子 RPC；生产环境限流不可用时，敏感写入会 fail-closed。
- In Vercel production, client identity trusts `x-vercel-forwarded-for` (falling back to `x-real-ip`) only when `VERCEL=1`. Arbitrary `x-forwarded-for` is ignored. Non-Vercel public deployments must define and test an equivalent trusted-proxy rule before launch. / Vercel 生产环境仅在 `VERCEL=1` 时信任 `x-vercel-forwarded-for`（回退到 `x-real-ip`），任意 `x-forwarded-for` 会被忽略。非 Vercel 公网部署上线前必须定义并测试等价可信代理规则。
- Schedule `cleanup_api_abuse_protection(90)` at least daily and monitor `security_events` for blocked requests, login failures, and limiter storage errors. The table stores HMAC hashes, not raw IP addresses, passwords, tokens, cookies, or request bodies. / 至少每日调度一次 `cleanup_api_abuse_protection(90)`，并监控 `security_events` 中的阻断请求、登录失败和限流存储异常。表中只保存 HMAC 哈希，不保存原始 IP、密码、token、cookie 或完整请求体。
- Apply `20260612193000_member_consents_and_deletion_requests.sql` before enabling new registration and account-rights controls. Confirm the decisions in `docs/LEGAL_REVIEW_CHECKLIST.md` before treating the draft legal pages or confirmed deletion queue as production-complete. / 启用新注册与账户权利控制前应用 `20260612193000_member_consents_and_deletion_requests.sql`。在把法律草稿页面或已确认删除队列视为生产完成前，必须确认 `docs/LEGAL_REVIEW_CHECKLIST.md` 中的决策。

## Hosting Notes / 托管说明

Vercel can deploy this app as a zero-config Next.js project. Configure the production environment variables above in the Vercel project settings before promoting a production deployment.

Vercel 可以按零配置 Next.js 项目部署此应用。正式发布前，需要先在 Vercel 项目设置中配置上面的生产环境变量。

After deployment, use the response `x-request-id` to correlate member-flow failures in Vercel Runtime Logs. Unexpected `*.failed` events are emitted at error level and can be queried with `vercel logs <deployment-url> --level error --since 1h`. Follow [`OBSERVABILITY_RUNBOOK.md`](./OBSERVABILITY_RUNBOOK.md) for event names, privacy boundaries, common queries, and escalation steps.

部署后，使用响应中的 `x-request-id` 在 Vercel Runtime Logs 中关联会员关键路径故障。意外的 `*.failed` 事件统一按 error 级别输出，可通过 `vercel logs <deployment-url> --level error --since 1h` 查询。事件名、隐私边界、常用查询和升级步骤见 [`OBSERVABILITY_RUNBOOK.md`](./OBSERVABILITY_RUNBOOK.md)。

For another Node-compatible host, run:

如果使用其他兼容 Node.js 的托管平台，运行：

```powershell
corepack pnpm build
corepack pnpm start
```

The host must provide Node.js 24 for parity with CI and must keep server-only environment variables out of client bundles.

托管平台应提供 Node.js 24，以保持和 CI 一致，并确保服务端专用环境变量不会进入客户端 bundle。

## Release Automation Gate / 发布自动化门禁

GitHub Actions now separates the release gate into four required-check candidates:

GitHub Actions 现在把发布门禁拆成四个可设置为必需检查的 job：

- `Quality gate / 质量门禁`: ESLint and TypeScript checks. / ESLint 与 TypeScript 检查。
- `API and security regression / API 与安全回归`: production dependency audit plus settlement, stub-crediting, abuse-protection, legal/account-rights, and API security regression tests. / 生产依赖审计，以及结算、stub 入账、滥用防护、法律/账户权利和 API 安全回归测试。
- `Production build / 生产构建`: production `next build`. / 生产构建。
- `Playwright E2E / 浏览器端到端`: isolated browser/API flow covering login, four core tables, replay safety, cash-out, and rejected attack attempts. / 隔离浏览器/API 流程，覆盖登录、四张核心桌、重放安全、cash-out 和攻击尝试拒绝。

Playwright failure artifacts are uploaded only on failure from `playwright-report/` and `test-results/e2e/`. These artifacts use local non-production E2E credentials and must not include production secrets.

Playwright 只在失败时上传 `playwright-report/` 与 `test-results/e2e/`。这些证据使用本地非生产 E2E 凭据，不应包含生产秘密。

Local command groups:

本地命令组：

```powershell
corepack pnpm lint
corepack pnpm test:node
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test:e2e
```

## Final Gate / 最终检查

Before opening or merging a deploy-readiness PR, run:

在打开或合并部署就绪 PR 前，运行：

```powershell
corepack pnpm run ci
git status --short --branch
```

`corepack pnpm run ci` runs lint, production dependency audit, Node security regression tests, typecheck, and production build. Playwright E2E is also enforced in GitHub Actions as a separate job so browser failure evidence can be uploaded cleanly.

`corepack pnpm run ci` 会执行 lint、生产依赖审计、Node 安全回归测试、类型检查和生产构建。Playwright E2E 在 GitHub Actions 中作为独立 job 执行，便于单独上传浏览器失败证据。

The branch should have only intentional source and documentation changes. Generated `.next` output and TypeScript build info files should remain untracked.

分支中应只包含有意提交的源码和文档变更。生成的 `.next` 产物和 TypeScript build info 文件不应进入版本控制。
