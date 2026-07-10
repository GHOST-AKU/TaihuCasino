# Task Queue / 任务队列

Last updated / 更新日期: 2026-07-09

| ID | Status | Task / 任务 | Scope / 范围 | Exit criteria / 完成标准 |
| --- | --- | --- | --- | --- |
| P0-ROUND-PR1 | In progress / 进行中 | Core tables single authoritative round / 核心桌台单一权威回合 | Dice, roulette, baccarat, shared API contract, docs, tests / 骰子、轮盘、百家乐、共享 API 契约、文档、测试 | `round` envelope returned and consumed; UI waits for server; `ci` and `test:e2e` pass; draft PR opened / 返回并消费 `round` envelope；UI 等服务端；`ci` 与 `test:e2e` 通过；草稿 PR 已开 |
| P0-ROUND-PR2 | Pending / 待办 | Server-authoritative blackjack / 服务端权威 21 点 | Migration, state machine, actions endpoint, refresh recovery, timeout/void, local cookie parity / 迁移、状态机、动作端点、刷新恢复、超时作废、本地 cookie 语义一致 | Separate branch after PR1 merge; closes #66 only when complete / PR1 合并后新分支；完成后才关闭 #66 |
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
- [ ] Draft bilingual PR. / 双语草稿 PR。
