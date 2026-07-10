# Task Queue / 任务队列

Last updated / 更新日期: 2026-07-10

| ID | Status | Task / 任务 | Scope / 范围 | Exit criteria / 完成标准 |
| --- | --- | --- | --- | --- |
| P0-ROUND-PR1 | Done / 已完成 | Core tables single authoritative round / 核心桌台单一权威回合 | Dice, roulette, baccarat, shared API contract, docs, tests / 骰子、轮盘、百家乐、共享 API 契约、文档、测试 | PR #67 merged to `main` at `9f69f48`; #66 remains open for PR2 / PR #67 已合并到 `main@9f69f48`；#66 为 PR2 保持开启 |
| P0-ROUND-PR2 | In progress / 进行中 | Server-authoritative blackjack / 服务端权威 21 点 | Migration, state machine, actions endpoint, refresh recovery, timeout/void, local cookie parity / 迁移、状态机、动作端点、刷新恢复、超时作废、本地 cookie 语义一致 | Draft PR opened from `codex/authoritative-blackjack-rounds`; closes #66 only when complete / 从 `codex/authoritative-blackjack-rounds` 创建草稿 PR；完成后才关闭 #66 |
| RELEASE-GATE | Blocked / 阻断中 | Release gate decision / 发布门禁决策 | MVP-R2 gameplay release / MVP-R2 玩法发布 | Remains `NO-GO` until PR1 and PR2 both land green / PR1 与 PR2 全部绿色落地前保持 `NO-GO` |

## PR1 checklist / PR1 检查清单

- [x] Create branch from latest `main`. / 从最新 `main` 创建分支。
- [x] Create parent P0 GitHub Issue and project metadata. / 创建 P0 父 Issue 与项目元数据。
- [x] Add failing UI regression first, then fix. / 先写失败 UI 回归，再修复。
- [x] Add `RoundEnvelope<TResult>`. / 新增 `RoundEnvelope<TResult>`。
- [x] Return canonical `round` from local cookie, direct Supabase, and Supabase RPC-compatible paths. / 本地 cookie、直接 Supabase、Supabase RPC 兼容路径返回 canonical `round`。
- [x] Convert dice to authoritative final result. / 骰子最终结果改为权威回合。
- [x] Convert roulette to authoritative final result. / 轮盘最终结果改为权威回合。
- [x] Convert baccarat and VIP/shared variants to authoritative final result. / 百汇乐及 VIP/共享变体最终结果改为权威回合。
- [x] Hydrate table result/stat/history from server rounds. / 从服务端回合恢复桌台结果/统计/历史。
- [x] Keep browser `localStorage` to stake/chip preferences only. / 浏览器 `localStorage` 仅保留下注/筹码偏好。
- [x] Full `corepack pnpm run ci`. / 完整 `corepack pnpm run ci`。
- [x] Full `corepack pnpm run test:e2e`. / 完整 `corepack pnpm run test:e2e`。
- [x] Draft bilingual PR and merge after checks. / 双语草稿 PR，并在检查通过后合并。

## PR2 checklist / PR2 检查清单

- [x] Create branch from updated `main@9f69f48`. / 从更新后的 `main@9f69f48` 创建分支。
- [x] Add failing blackjack regression tests first. / 先添加会失败的 21 点回归测试。
- [x] Add `member_blackjack_round_states` migration. / 新增 `member_blackjack_round_states` 迁移。
- [x] Implement server-side deal/action state machine with hidden deck. / 实现带隐藏牌堆的服务端发牌/动作状态机。
- [x] Implement command idempotency and stale-version `409`. / 实现命令幂等与旧版本 `409`。
- [x] Implement refresh recovery and timeout voiding. / 实现刷新恢复与超时作废。
- [x] Block cash-out while an active blackjack round exists. / 活跃 21 点回合存在时阻断离桌。
- [x] Convert blackjack UI to consume server-returned cards/actions only. / 21 点 UI 仅消费服务端返回的牌和可用动作。
- [x] Full `corepack pnpm run ci`. / 完整 `corepack pnpm run ci`。
- [x] Full `corepack pnpm run test:e2e`. / 完整 `corepack pnpm run test:e2e`。
- [ ] Draft bilingual PR that closes #66 only when PR2 is complete. / 创建双语草稿 PR，且仅在 PR2 完成时关闭 #66。
