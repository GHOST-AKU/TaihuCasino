# TaihuCasino Project Truth Source / 项目真相源

Last updated / 更新日期: 2026-07-09

## Current objective / 当前目标

P0 gameplay integrity: remove client/server “double result” behavior by making one server-authored round envelope the single source of truth for final result, chip balance, round delta, statistics, and history.

P0 玩法完整性：移除客户端与服务端“双结果”，让一个服务端生成的回合 envelope 成为最终结果、筹码余额、本轮盈亏、统计与历史的唯一真相源。

## Active branch and tracker / 当前分支与追踪

- Branch / 分支: `codex/authoritative-round-core-tables`
- Parent Issue / 父 Issue: GitHub #66 `P0 Gameplay: 单一权威回合与一致性 UI / Single authoritative round and consistent UI`
- Release status / 发布状态: `NO-GO` until PR1 and PR2 are both complete. / PR1 与 PR2 全部完成前维持 `NO-GO`。

## Scope / 范围

In scope for PR1 / PR1 范围:

- Shared `RoundEnvelope<TResult>` contract. / 共享 `RoundEnvelope<TResult>` 契约。
- Canonical `/api/member/game-rounds` response field `round`, while keeping `progress`, `settlement`, and `idempotent` for one compatibility cycle. / `/api/member/game-rounds` 新增 canonical `round`，并临时保留 `progress`、`settlement`、`idempotent` 兼容一个发布周期。
- Dice, roulette, baccarat main table, baccarat VIP, and roulette fast-table variants that share the same rule sets. / 骰子、轮盘、百家乐主桌、百家乐 VIP、共享同规则的轮盘快桌。
- Supabase RPC, direct Supabase, and local cookie paths returning the persisted round ID. / Supabase RPC、直接 Supabase、本地 cookie 三条路径返回真实持久化回合 ID。
- UI waits for the server, then atomically applies result, balance, statistics, and history from the same envelope. / UI 等待服务端，再从同一 envelope 原子应用结果、余额、统计与历史。

Out of scope for PR1 / PR1 不做:

- Multi-step server-authoritative blackjack state machine. / 多步服务端权威 21 点状态机。
- OGO/Taihu strategic issue #61. / OGO/Taihu 战略 Issue #61。
- Full table directory refactor, mobile redesign, or visual packaging expansion. / 完整目录重构、移动端重做或视觉包装扩展。
- Cleanup of unrelated existing ESLint warnings. / 清理无关的既有 ESLint warning。

## Done in PR1 so far / PR1 当前已完成

- Created the P0 parent GitHub Issue and added it to `TaihuCasino Delivery #2` with P0/MVP-R2/In Progress metadata. / 已创建 P0 父 Issue，并加入 `TaihuCasino Delivery #2`，设置 P0/MVP-R2/In Progress 元数据。
- Added regression coverage showing the UI must not mutate bankroll or round delta before the authoritative response arrives. / 已新增回归测试，证明权威响应前 UI 不得改变余额或本轮盈亏。
- Added the shared round contract and canonical response parsing. / 已新增共享回合契约与 canonical 响应解析。
- Converted dice, roulette, and baccarat to server-first final-result flow. / 已将骰子、轮盘、百家乐改为服务端优先的最终结果流程。
- Removed final-result, balance, history, and statistics persistence from browser `localStorage`; only stake/chip preferences remain. / 已从浏览器 `localStorage` 移除最终结果、余额、历史、统计持久化，仅保留筹码和下注偏好。

## Remaining before PR1 handoff / PR1 交接前剩余

- Confirm no generated files remain in the worktree. / 确认工作区无生成文件漂移。
- Commit, push, and open a bilingual draft PR referencing but not closing #66. / 提交、推送并创建双语草稿 PR，只关联但不关闭 #66。
