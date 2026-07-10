# State Snapshot / 状态快照

Last updated / 更新日期: 2026-07-10

```yaml
current_phase: verified-pr2-ready-to-publish / PR2 已验证待发布
branch: codex/authoritative-blackjack-rounds
base: main@9f69f48
parent_issue: https://github.com/GHOST-AKU/TaihuCasino/issues/66
release_gate: NO-GO until PR2 completes / PR2 完成前 NO-GO
```

## Current implementation state / 当前实现状态

- PR1 is merged to `main`; PR2 branch is active from the updated merge commit. / PR1 已合并到 `main`；PR2 分支已从更新后的合并提交创建。
- Dice, roulette, and baccarat now submit bet intent, wait for the server, and apply final state from one returned envelope. / 骰子、轮盘、百家乐现在提交下注意图、等待服务端，并从同一个返回 envelope 应用最终状态。
- Baccarat final message now uses `envelope.summary`, aligning cards, result, balance, statistics, and summary to the same round. / 百汇乐最终消息改用 `envelope.summary`，让牌面、结果、余额、统计和摘要来自同一回合。
- Supabase RPC compatibility is migration-free: old RPC payloads can be followed by an idempotency-key lookup for the persisted round. / Supabase RPC 兼容不依赖迁移：旧 RPC payload 可通过幂等键回查持久化回合。
- Blackjack still needs PR2 conversion from client shuffle/settlement to a server-side multi-step state machine. / 21 点仍需 PR2 从客户端洗牌/结算改为服务端多步状态机。
- Blackjack now uses a server-side state machine, hidden deck, versioned actions endpoint, command idempotency, stale-version `409`, timeout voiding, and cash-out blocking. / 21 点现在使用服务端状态机、隐藏牌堆、版本化动作端点、命令幂等、旧版本 `409`、超时作废和离桌阻断。

## Verification evidence so far / 当前验证证据

- `corepack pnpm typecheck` passed after the core implementation. / 核心实现后 `corepack pnpm typecheck` 已通过。
- `corepack pnpm exec playwright test tests/e2e/authoritative-round-ui.spec.ts --project=chromium` passed: 3 tests. / 三桌权威 UI 回归已通过：3 条。
- `corepack pnpm exec playwright test tests/e2e/release-gate.spec.ts --project=chromium --grep "four core tables"` passed: 1 test. / 四桌 API release gate 目标回归已通过：1 条。
- `corepack pnpm run test:e2e` passed: 10 tests. / 完整 Playwright E2E 已通过：10 条。
- `corepack pnpm run ci` passed. It still reports 4 existing ESLint warnings, 0 errors. / 完整 CI 已通过；仍有 4 个既有 ESLint warning，0 error。
- Local branch/status checked after PR1 merge: `main` and `origin/main` are at `9f69f48`, then PR2 branch was created. / PR1 合并后已核对本地分支状态：`main` 与 `origin/main` 均在 `9f69f48`，随后创建 PR2 分支。
- PR2 red/green evidence: `corepack pnpm test:blackjack-engine` first failed because `lib/blackjack-engine.ts` did not exist, then passed after implementation. / PR2 红绿证据：`corepack pnpm test:blackjack-engine` 起初因 `lib/blackjack-engine.ts` 不存在而失败，实现后通过。
- `corepack pnpm run ci` passed on PR2. Lint reports 3 existing warnings, 0 errors. / PR2 上 `corepack pnpm run ci` 已通过；lint 报 3 个既有 warning，0 error。
- `corepack pnpm run test:e2e` passed: 13 tests. / `corepack pnpm run test:e2e` 已通过：13 条。
- `corepack pnpm exec supabase migration list --local` could not connect because local Postgres on `127.0.0.1:54322` is not running. / `corepack pnpm exec supabase migration list --local` 因本地 `127.0.0.1:54322` Postgres 未运行无法连接。

## Next actions / 下一步

1. Confirm no generated files remain in the worktree. / 确认工作区无生成文件漂移。
2. Commit, push, and open a bilingual draft PR for PR2. / 提交、推送并创建 PR2 双语草稿 PR。
3. Keep Issue #66 open until PR2 is reviewed/merged; release remains `NO-GO` until then. / PR2 审查/合并前保持 Issue #66 开启；发布仍为 `NO-GO`。
