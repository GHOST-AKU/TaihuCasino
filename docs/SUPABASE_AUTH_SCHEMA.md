# Supabase Auth Schema

## Decision

TaihuCasino uses Supabase Auth as the identity source for the Next.js product line. The app keeps its existing member API surface:

- `POST /api/auth/login`
- `POST /api/auth/oauth`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `GET /auth/callback`

The API returns the local `MemberSession` shape so the current lobby and navigation components do not need to know about Supabase internals.

## Environment

Set these variables in local and deployment environments:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TAIHU_SESSION_SECRET=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted as a compatibility fallback. `SUPABASE_SERVICE_ROLE_KEY` is not required for the auth/session handshake itself, but it is required by current server-side member and wallet mutation paths. Keep it server-only and never expose it through `NEXT_PUBLIC_*`. `TAIHU_SESSION_SECRET` signs fallback session cookies and should be set in production so fallback paths never use local development defaults.

`NEXT_PUBLIC_SUPABASE_ANON_KEY` 也可作为兼容回退。`SUPABASE_SERVICE_ROLE_KEY` 不是登录/session 握手本身的必需项，但当前服务端会员和钱包写入路径需要它。该变量必须只存在于服务端环境，绝不能通过 `NEXT_PUBLIC_*` 暴露。`TAIHU_SESSION_SECRET` 用于签名回退 session cookie，生产环境应配置它，避免回退路径使用本地开发默认值。

If Supabase variables are missing, local development can still use the legacy demo account path from `TAIHU_AUTH_*`. Production should configure Supabase and should not rely on the legacy fallback.

If registration remains enabled, configure both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and Supabase Auth CAPTCHA/Turnstile backend settings. Production OAuth also requires the Supabase Site URL, `/auth/callback` redirect allowlist, and the enabled provider credentials.

如果注册页继续启用，需要同时配置 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 和 Supabase Auth CAPTCHA/Turnstile 后台设置。生产 OAuth 还需要配置 Supabase Site URL、`/auth/callback` redirect allowlist，以及已启用 provider 的凭据。

## Profile Boundary

Supabase owns authentication in `auth.users`. TaihuCasino-owned member profile data starts in `public.profiles`.

The initial migration is:

```text
supabase/migrations/20260418_init_auth_profiles.sql
```

It creates:

- `public.profiles.id`, referencing `auth.users(id)`
- `display_name`
- `avatar_url`
- `created_at`
- `updated_at`
- RLS policies that limit reads, inserts, and updates to the signed-in user
- a trigger that creates a profile row after a new auth user is inserted

Future member tables should follow the same pattern: use `user_id uuid references auth.users(id)`, enable RLS, and gate member-owned rows with `auth.uid() = user_id`.

## Member Data Boundary

The temporary test branch adds a second migration:

```text
supabase/migrations/20260418_member_data.sql
```

It creates member-owned tables for the new member center and migrated game routes:

- `public.member_settings`: theme, language, notification, privacy, quick bet, density, and responsible play limit.
- `public.member_wallets`: test-credit balance and bonus balance for the prototype experience.
- `public.member_game_progress`: per-game plays, wins, losses, streaks, bankroll, and latest settlement summary.
- `public.member_events`: short audit/event stream for member-facing activity.

All four tables enable RLS and only allow authenticated users to read, insert, or update rows where `auth.uid() = user_id`. Normal profile/settings/progress reads and writes stay user-scoped. Current wallet and member mutation paths that need trusted server-side writes use `SUPABASE_SERVICE_ROLE_KEY` through server-only code.

这四张表都启用 RLS，只允许已登录用户读写 `auth.uid() = user_id` 的行。普通 profile/settings/progress 读写仍然保持用户作用域。当前需要可信服务端写入的钱包和会员 mutation 路径，会通过服务端代码使用 `SUPABASE_SERVICE_ROLE_KEY`。

The API contract is:

- `GET /api/member/me`
- `GET/PATCH /api/member/profile`
- `GET/PATCH /api/member/settings`
- `GET/POST /api/member/progress`

When Supabase is not configured, local development stores non-sensitive profile/settings/progress test data in a signed, `httpOnly`, same-site cookie. This fallback is for development and preview smoke tests only.

## OAuth Providers

The login page now starts real Supabase OAuth for:

- Google
- Apple
- Microsoft, mapped to Supabase `azure`
- Facebook
- X

Amazon remains disabled because Supabase Auth does not expose an Amazon provider in the installed auth provider type list.

## Session Rules

Server code should use `supabase.auth.getUser()` or `supabase.auth.getClaims()` for trusted identity checks. Do not trust client-provided session objects for authorization.

`proxy.ts` refreshes Supabase cookies when Supabase is configured. Routes that set auth cookies send `cache-control: private, no-store` to avoid caching another user's session response.
