# TaihuCasino Project Truth Source / 项目真相源

Last updated / 更新日期: 2026-07-10

## Current objective / 当前目标

P0 gameplay integrity: remove client/server “double result” behavior by making one server-authored round envelope the single source of truth for final result, chip balance, round delta, statistics, and history.

P0 玩法完整性：移除客户端与服务端“双结果”，让一个服务端生成的回合 envelope 成为最终结果、筹码余额、本轮盈亏、统计与历史的唯一真相源。

## Active branch and tracker / 当前分支与追踪

- Branch / 分支: `codex/authoritative-blackjack-rounds`
- Parent Issue / 父 Issue: GitHub #66 `P0 Gameplay: 单一权威回合与一致性 UI / Single authoritative round and consistent UI`
- Release status / 发布状态: `NO-GO`; PR1 is merged, PR2 is still required before release. / `NO-GO`；PR1 已合并，PR2 完成前不得发布。

## Scope / 范围

Completed in PR1 / PR1 已完成:

- Shared `RoundEnvelope<TResult>` contract. / 共享 `RoundEnvelope<TResult>` 契约。
- Canonical `/api/member/game-rounds` response field `round`, while keeping `progress`, `settlement`, and `idempotent` for one compatibility cycle. / `/api/member/game-rounds` 新增 canonical `round`，并临时保留 `progress`、`settlement`、`idempotent` 兼容一个发布周期。
- Dice, roulette, baccarat main table, baccarat VIP, and roulette fast-table variants that share the same rule sets. / 骰子、轮盘、百家乐主桌、百家乐 VIP、共享同规则的轮盘快桌。
- Supabase RPC, direct Supabase, and local cookie paths returning the persisted round ID. / Supabase RPC、直接 Supabase、本地 cookie 三条路径返回真实持久化回合 ID。
- UI waits for the server, then atomically applies result, balance, statistics, and history from the same envelope. / UI 等待服务端，再从同一 envelope 原子应用结果、余额、统计与历史。

In scope for PR2 / PR2 范围:

- `member_blackjack_round_states` migration for hidden deck, phase, hands, command idempotency, expiry, and final round linkage. / 新增 `member_blackjack_round_states` 迁移，保存隐藏牌堆、阶段、手牌、命令幂等、过期时间与最终回合关联。
- `POST /api/member/game-rounds` creates or restores an active blackjack state instead of settling a final result immediately. / `POST /api/member/game-rounds` 对 21 点创建或恢复活跃状态，不再立即结算最终结果。
- `POST /api/member/game-rounds/[roundId]/actions` applies versioned hit, stand, double, split, insurance, and skip-insurance commands. / `POST /api/member/game-rounds/[roundId]/actions` 执行带版本的 hit、stand、double、split、insurance 与 skip-insurance 命令。
- Client blackjack UI displays only server-returned cards/actions and applies the final `RoundEnvelope` once. / 21 点客户端 UI 只展示服务端返回的牌/动作，并只在最终 `RoundEnvelope` 返回时一次性应用结算。
- Active blackjack rounds block cash-out; expired active rounds are voided without changing chips before cash-out can proceed. / 活跃 21 点回合阻断离桌；过期活跃回合先安全作废且不改变筹码，再允许离桌。
- Local cookie development path mirrors the same state-machine semantics. / 本地 cookie 开发路径实现相同状态机语义。

Out of scope / 不做:

- OGO/Taihu strategic issue #61. / OGO/Taihu 战略 Issue #61。
- Full table directory refactor, mobile redesign, or visual packaging expansion. / 完整目录重构、移动端重做或视觉包装扩展。
- Cleanup of unrelated existing ESLint warnings. / 清理无关的既有 ESLint warning。

## Done / 已完成

- Created the P0 parent GitHub Issue and added it to `TaihuCasino Delivery #2` with P0/MVP-R2/In Progress metadata. / 已创建 P0 父 Issue，并加入 `TaihuCasino Delivery #2`，设置 P0/MVP-R2/In Progress 元数据。
- Added regression coverage showing the UI must not mutate bankroll or round delta before the authoritative response arrives. / 已新增回归测试，证明权威响应前 UI 不得改变余额或本轮盈亏。
- Added the shared round contract and canonical response parsing. / 已新增共享回合契约与 canonical 响应解析。
- Converted dice, roulette, and baccarat to server-first final-result flow. / 已将骰子、轮盘、百家乐改为服务端优先的最终结果流程。
- Removed final-result, balance, history, and statistics persistence from browser `localStorage`; only stake/chip preferences remain. / 已从浏览器 `localStorage` 移除最终结果、余额、历史、统计持久化，仅保留筹码和下注偏好。
- Merged PR1 into `main` as merge commit `9f69f48`; Issue #66 remains open/in progress for PR2. / PR1 已以 merge commit `9f69f48` 合并到 `main`；Issue #66 为 PR2 保持开启/进行中。

## Remaining for PR2 / PR2 剩余

- Add failing blackjack state-machine/API/UI regression coverage first. / 先添加会失败的 21 点状态机、API 与 UI 回归测试。
- Implement the Supabase and local-cookie blackjack state machine. / 实现 Supabase 与本地 cookie 21 点状态机。
- Convert blackjack UI off client shuffle/settlement. / 将 21 点 UI 从客户端洗牌/结算迁出。
- Pass `corepack pnpm run ci`, `corepack pnpm run test:e2e`, GitHub Actions, then open a bilingual draft PR. / 通过 `corepack pnpm run ci`、`corepack pnpm run test:e2e`、GitHub Actions，然后创建双语草稿 PR。
