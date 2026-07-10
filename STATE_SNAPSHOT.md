# State Snapshot / 状态快照

Last updated / 更新日期: 2026-07-09

```yaml
current_phase: execute / 执行
branch: codex/authoritative-round-core-tables
base: main@1131b72
parent_issue: https://github.com/GHOST-AKU/TaihuCasino/issues/66
release_gate: NO-GO until PR1 and PR2 both complete / PR1 与 PR2 全部完成前 NO-GO
```

## Current implementation state / 当前实现状态

- PR1 branch is active and contains the core-table authoritative round work. / PR1 分支已启用，包含核心桌台权威回合工作。
- Dice, roulette, and baccarat now submit bet intent, wait for the server, and apply final state from one returned envelope. / 骰子、轮盘、百家乐现在提交下注意图、等待服务端，并从同一个返回 envelope 应用最终状态。
- Baccarat final message now uses `envelope.summary`, aligning cards, result, balance, statistics, and summary to the same round. / 百汇乐最终消息改用 `envelope.summary`，让牌面、结果、余额、统计和摘要来自同一回合。
- Supabase RPC compatibility is migration-free: old RPC payloads can be followed by an idempotency-key lookup for the persisted round. / Supabase RPC 兼容不依赖迁移：旧 RPC payload 可通过幂等键回查持久化回合。

## Verification evidence so far / 当前验证证据

- `corepack pnpm typecheck` passed after the core implementation. / 核心实现后 `corepack pnpm typecheck` 已通过。
- `corepack pnpm exec playwright test tests/e2e/authoritative-round-ui.spec.ts --project=chromium` passed: 3 tests. / 三桌权威 UI 回归已通过：3 条。
- `corepack pnpm exec playwright test tests/e2e/release-gate.spec.ts --project=chromium --grep "four core tables"` passed: 1 test. / 四桌 API release gate 目标回归已通过：1 条。
- `corepack pnpm run test:e2e` passed: 10 tests. / 完整 Playwright E2E 已通过：10 条。
- `corepack pnpm run ci` passed. It still reports 4 existing ESLint warnings, 0 errors. / 完整 CI 已通过；仍有 4 个既有 ESLint warning，0 error。

## Next actions / 下一步

1. Restore generated `next-env.d.ts` if `next typegen` rewrites it. / 如果 `next typegen` 改写 `next-env.d.ts`，恢复该生成物漂移。
2. Commit, push, and open a bilingual draft PR that references but does not close #66. / 提交、推送并创建双语草稿 PR，只引用但不关闭 #66。
