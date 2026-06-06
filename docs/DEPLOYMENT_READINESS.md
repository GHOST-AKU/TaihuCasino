# Deployment Readiness / 部署就绪说明

Last updated: 2026-05-31

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
- `TAIHU_SESSION_SECRET`: long random secret for signing fallback member session cookies. Configure it in production so legacy/fallback cookie paths cannot fail open or use development defaults. / 用于签名回退会员 session cookie 的长随机密钥。生产环境必须配置，避免 legacy/fallback cookie 路径使用开发默认值或异常。

Required when registration remains enabled with Cloudflare Turnstile:

如果注册页继续启用 Cloudflare Turnstile，还需要：

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: Turnstile site key used by the registration form. / 注册表单使用的 Turnstile site key。

Development-only fallback auth:

仅限本地开发的回退账号：

- `TAIHU_AUTH_ACCOUNT` and `TAIHU_AUTH_PASSWORD`: one fallback account. / 单个回退账号。
- `TAIHU_AUTH_USERS`: JSON array of fallback users, for example `[{"account":"member@example.com","password":"change-me","displayName":"Member"}]`. / 回退用户 JSON 数组，例如 `[{"account":"member@example.com","password":"change-me","displayName":"Member"}]`。

Optional development/testing switch:

可选开发/测试开关：

- `TAIHU_ENABLE_TEST_WALLET_TOPUP`: enables the test wallet top-up endpoint in production only when explicitly set to `true`. Keep it unset or false for normal production deployments. / 仅在显式设置为 `true` 时允许生产环境测试充值入口。常规生产部署应保持未设置或 false。

When Supabase variables are missing, local development can use the built-in demo account or the `TAIHU_AUTH_*` fallback. Production deployments should configure Supabase and should not rely on demo or fallback credentials.

当 Supabase 变量缺失时，本地开发可以使用内置 demo 账号或 `TAIHU_AUTH_*` 回退账号。生产部署必须配置 Supabase，不应依赖 demo 或回退账号。

## Supabase Auth Production Checklist / Supabase Auth 生产配置清单

Environment variables alone are not enough. Before promoting a production deployment, configure Supabase Auth and provider settings.

仅配置环境变量还不够。生产发布前，还需要配置 Supabase Auth 和第三方登录提供商。

- Set the Supabase Auth Site URL to the production origin. / 将 Supabase Auth Site URL 设置为生产域名。
- Add the production `/auth/callback` URL to the redirect allowlist. Add preview URLs if preview OAuth testing is required. / 将生产环境 `/auth/callback` 加入 redirect allowlist。如需在预览环境测试 OAuth，也加入预览 URL。
- Configure OAuth providers used by the login page: Google, Apple, Microsoft/Azure, Facebook, and X. Amazon is disabled in the current app. / 配置登录页使用的 OAuth provider：Google、Apple、Microsoft/Azure、Facebook 和 X。当前应用中 Amazon 已禁用。
- If registration is enabled, configure Supabase CAPTCHA/Turnstile backend settings in addition to `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. The registration API passes `captchaToken` to `supabase.auth.signUp`. / 如果启用注册，除 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 外，还要配置 Supabase CAPTCHA/Turnstile 后台设置。注册 API 会把 `captchaToken` 传给 `supabase.auth.signUp`。
- Apply the Supabase migrations in `supabase/migrations/` before testing member, wallet, table session, ad reward, purchase, and game round APIs. / 在测试会员、钱包、桌台 session、广告奖励、购买和游戏回合 API 前，先应用 `supabase/migrations/` 中的迁移。
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. It is required by server-side member and wallet mutation code paths, but must never be exposed in `NEXT_PUBLIC_*` variables. / `SUPABASE_SERVICE_ROLE_KEY` 必须只存在于服务端环境。服务端会员和钱包写入路径需要它，但绝不能放进 `NEXT_PUBLIC_*` 变量。

## Hosting Notes / 托管说明

Vercel can deploy this app as a zero-config Next.js project. Configure the production environment variables above in the Vercel project settings before promoting a production deployment.

Vercel 可以按零配置 Next.js 项目部署此应用。正式发布前，需要先在 Vercel 项目设置中配置上面的生产环境变量。

For another Node-compatible host, run:

如果使用其他兼容 Node.js 的托管平台，运行：

```powershell
corepack pnpm build
corepack pnpm start
```

The host must provide Node.js 24 for parity with CI and must keep server-only environment variables out of client bundles.

托管平台应提供 Node.js 24，以保持和 CI 一致，并确保服务端专用环境变量不会进入客户端 bundle。

## Final Gate / 最终检查

Before opening or merging a deploy-readiness PR, run:

在打开或合并部署就绪 PR 前，运行：

```powershell
corepack pnpm run ci
git status --short --branch
```

`corepack pnpm run ci` runs the same typecheck and production build gates.

`corepack pnpm run ci` 会执行同一套类型检查和生产构建 gate。

The branch should have only intentional source and documentation changes. Generated `.next` output and TypeScript build info files should remain untracked.

分支中应只包含有意提交的源码和文档变更。生成的 `.next` 产物和 TypeScript build info 文件不应进入版本控制。
