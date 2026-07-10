# Authoritative Round Architecture / 权威回合架构

Last updated / 更新日期: 2026-07-09

## Goal / 目标

TaihuCasino gameplay must have one authoritative settled round. A client may animate previews, but final result, chip balance, round delta, statistics, and history must all come from one server-authored envelope.

TaihuCasino 玩法必须只有一个权威已结算回合。客户端可以播放预览动画，但最终结果、筹码余额、本轮盈亏、统计和历史都必须来自同一个服务端 envelope。

## Round envelope / 回合 Envelope

`RoundEnvelope<TResult>` is the shared contract between `/api/member/game-rounds` and PR1 table clients.

`RoundEnvelope<TResult>` 是 `/api/member/game-rounds` 与 PR1 桌台客户端之间的共享契约。

```ts
type RoundEnvelope<TResult> = {
  roundId: string
  gameSlug: string
  tableSessionId: string
  status: "settled" | "rejected" | "voided"
  version: 1
  outcome: "win" | "loss" | "push"
  delta: number
  totalStake: number
  chipBalanceBefore: number
  chipBalanceAvailable: number
  chipBalanceAfter: number
  summary: string
  betSnapshot: Record<string, unknown>
  resultSnapshot: TResult
  serverTimestamp: string
  idempotent: boolean
}
```

For one compatibility cycle, the API also returns the legacy `progress`, `settlement`, and top-level `idempotent` fields. New PR1 clients must prefer `round`.

为了兼容一个发布周期，API 仍返回旧的 `progress`、`settlement` 和顶层 `idempotent` 字段。新的 PR1 客户端必须优先使用 `round`。

## Request flow / 请求流程

1. Client validates that there is an active table session and at least one bet. / 客户端确认存在 active table session 且至少有一笔下注。
2. Client creates or reuses an idempotency key for the unresolved round. / 客户端为未完成回合创建或复用幂等键。
3. Client submits only canonical bet intent to `/api/member/game-rounds`. / 客户端只向 `/api/member/game-rounds` 提交规范化下注意图。
4. Client enters a pending/syncing state; no final win/loss, balance, statistics, or history changes are shown. / 客户端进入 pending/syncing 状态；不得显示最终输赢、余额、统计或历史变化。
5. Server settles the round with backend RNG and fixed rules, persists the round, and returns `round`. / 服务端使用后端 RNG 和固定规则结算、持久化回合并返回 `round`。
6. Client applies result, balance, statistics, history, and summary from the same `round`. / 客户端从同一个 `round` 应用结果、余额、统计、历史和摘要。
7. If the request fails or network state is unknown, client keeps the same idempotency key and leaves the last settled round visible. / 如果请求失败或网络状态未知，客户端保留同一幂等键，并继续显示最后一个已结算回合。

## PR1 table behavior / PR1 桌台行为

Dice / 骰子:

- Rolling dice before the response is only visual preview. / 服务端响应前的骰子滚动只是视觉预览。
- Final dice, sum, triple flag, delta, and chip balance come from `round.resultSnapshot` and chip fields. / 最终骰子、点数、豹子标记、盈亏和筹码余额来自 `round.resultSnapshot` 与筹码字段。

Roulette / 轮盘:

- Wheel and ball motion may use random jitter. / 轮盘和小球动画可以使用随机扰动。
- Final pocket number is the server `round.resultSnapshot.result`. / 最终落袋号码来自服务端 `round.resultSnapshot.result`。
- Canvas screenshot regression keeps a final-number visual assertion. / Canvas 截图回归保留最终号码视觉断言。

Baccarat / 百汇乐:

- Client no longer shuffles or draws the shoe for final play. / 客户端不再为最终牌局洗牌或抽牌。
- Deal animation reveals only cards from `round.resultSnapshot.playerCards` and `round.resultSnapshot.bankerCards`. / 发牌动画只展示来自 `round.resultSnapshot.playerCards` 与 `round.resultSnapshot.bankerCards` 的牌。
- Final summary uses `round.summary`, not client-composed settlement prose. / 最终摘要使用 `round.summary`，不再由客户端拼接结算文案。

## Persistence paths / 持久化路径

Supabase RPC path / Supabase RPC 路径:

- Prefer `payload.round` when available. / 优先使用 `payload.round`。
- If an older RPC does not return `round`, load the persisted round by `userId + idempotencyKey`. / 如果旧 RPC 不返回 `round`，用 `userId + idempotencyKey` 回查持久化回合。

Direct Supabase path / 直接 Supabase 路径:

- Inserts the member game round and returns that persisted record. / 插入会员游戏回合并返回该持久化记录。
- Replayed idempotency keys return the existing round. / 重放幂等键返回既有回合。

Local cookie path / 本地 cookie 路径:

- Creates and stores a local `MemberGameRound`, then builds the envelope from that same record. / 创建并存储本地 `MemberGameRound`，再从同一记录构建 envelope。
- Development and E2E can run without local Supabase. / 开发与 E2E 不依赖本地 Supabase。

## Client storage boundary / 客户端存储边界

Allowed in `localStorage` / 允许保存到 `localStorage`:

- Current stake. / 当前下注额。
- Chip denominations. / 筹码面额。

Forbidden in `localStorage` / 禁止保存到 `localStorage`:

- Bankroll or table chip balance. / 资金或桌台筹码余额。
- Final result. / 最终结果。
- Round history. / 回合历史。
- Cumulative statistics. / 累计统计。

Page reload restores final display state from server/member round history.

页面刷新后的最终展示状态从服务端/会员回合历史恢复。

## Release gate / 发布门禁

PR1 is necessary but not sufficient for release. The parent P0 remains `NO-GO` until PR2 implements server-authoritative blackjack and all checks pass.

PR1 是必要但不充分条件。父 P0 在 PR2 完成服务端权威 21 点且所有检查通过前保持 `NO-GO`。

