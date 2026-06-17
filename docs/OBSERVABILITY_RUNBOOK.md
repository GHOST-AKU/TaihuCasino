# Member Flow Observability Runbook / 会员关键路径排障手册

This baseline covers login, table-session opening, authoritative game-round settlement, and cash-out. It uses structured JSON in Vercel Runtime Logs and does not require a paid APM platform.

本基线覆盖登录、开桌、服务端权威结算和 cash-out。它使用 Vercel Runtime Logs 中的结构化 JSON，不要求采购付费 APM。

## Request Correlation / 请求关联

Every instrumented response includes:

- `x-request-id`: the primary support and log-correlation identifier.
- `server-timing`: total application-handler duration in milliseconds.

Ask the user or operator to capture `x-request-id` from the failed HTTP response. Search that exact value in Vercel Runtime Logs to reconstruct the request.

让用户或值班人员从失败响应中保存 `x-request-id`，然后在 Vercel Runtime Logs 中搜索该值。

## Event Catalog / 事件目录

| Flow | Start | Success | Expected rejection | Unexpected failure |
| --- | --- | --- | --- | --- |
| Login | `auth.login.started` | `auth.login.succeeded` | `auth.login.rejected`, `auth.login.blocked` | `auth.login.failed` |
| Open table | `table_session.open.started` | `table_session.open.succeeded` | `table_session.open.rejected`, `table_session.open.blocked` | `table_session.open.failed` |
| Settle round | `game_round.settle.started` | `game_round.settle.succeeded` | `game_round.settle.rejected`, `game_round.settle.blocked` | `game_round.settle.failed` |
| Cash out | `cash_out.started` | `cash_out.succeeded` | `cash_out.rejected`, `cash_out.blocked` | `cash_out.failed` |

## Log Fields / 日志字段

- `schemaVersion`: currently `taihu-observability-v1`.
- `requestId`: correlation key returned to the client.
- `traceId`: W3C `traceparent` identifier when supplied by the platform.
- `vercelRequestId`: Vercel invocation identifier when available.
- `flow`, `event`, `route`, `method`, `status`, `durationMs`.
- `sessionHash`, `userHash`, `tableSessionHash`: short HMAC pseudonyms, never raw identifiers.
- `gameSlug`, `outcome`, `idempotent`, `reasonCode`.
- `errorType`, `errorMessage`: bounded and redacted before logging.

## Privacy Boundary / 隐私边界

Never log:

- passwords, OAuth codes, access/refresh tokens, cookies, authorization headers;
- raw email addresses, user IDs, table-session IDs, IP addresses;
- complete request or response bodies;
- payment proof, CAPTCHA tokens, or Supabase service-role errors containing credentials.

The shared observer hashes user, session, and table identifiers with `TAIHU_OBSERVABILITY_SECRET`, falling back to existing server-only rate-limit/session secrets. In production, no pseudonymous identifier is emitted if no server-only secret exists.

共享观察器优先使用 `TAIHU_OBSERVABILITY_SECRET`；也可回退到已有的服务端限流/session 密钥。生产环境缺少服务端密钥时，不输出伪匿名标识。

## First Response Checklist / 第一响应清单

1. Obtain the deployment environment, approximate time, route, and `x-request-id`.
2. Open the Vercel project, choose the matching deployment, and open Runtime Logs.
3. Search the exact `requestId`.
4. Read the final event and `reasonCode`.
5. If the request was blocked, correlate the same request ID with `security_events`.
6. Compare `durationMs`; unusually long successful requests may indicate provider/database latency.
7. Group repeated failures by `event`, `reasonCode`, `gameSlug`, and hashed session/table identifiers.
8. Do not ask users for passwords, cookies, tokens, or raw authorization headers.

## Common Queries / 常用查询

Use exact text search in Vercel Runtime Logs:

```text
"requestId":"<request-id>"
"event":"auth.login.failed"
"event":"game_round.settle.failed"
"event":"cash_out.failed"
"reasonCode":"rate_limit_unavailable"
"sessionHash":"<hash>"
"tableSessionHash":"<hash>"
```

CLI fallback when Vercel CLI authentication is available:

```powershell
vercel logs <deployment-url> --level error --since 1h
```

## Escalation Rules / 升级规则

- Repeated `auth_provider_error`: verify Supabase project health and auth configuration.
- Repeated `rate_limit_unavailable`: verify Supabase RPC availability and service-role configuration; sensitive writes intentionally fail closed in production.
- Repeated `table_session_open_failed`: check wallet/session RPC errors and game slug validity.
- Repeated `game_round_settlement_failed`: check active table session, stake validation, idempotency, and authoritative settlement rules.
- Repeated `cash_out_failed`: check session ownership, active status, and cash-out RPC/idempotency state.
- Any log containing an unredacted credential or personal identifier is a security incident; remove access, rotate the affected secret, and patch the logger.

## Local Verification / 本地验证

```powershell
corepack pnpm test:observability
corepack pnpm test:e2e
corepack pnpm run ci
```
