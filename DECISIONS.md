# Decisions / 决策日志

Last updated / 更新日期: 2026-07-10

## D-2026-07-09-01: Canonical round envelope with compatibility fields / Canonical round envelope 与兼容字段

Decision / 决策:

`/api/member/game-rounds` returns a new canonical `round: RoundEnvelope<TResult>` and keeps existing `progress`, `settlement`, and top-level `idempotent` fields for one release cycle.

`/api/member/game-rounds` 返回新的 canonical `round: RoundEnvelope<TResult>`，同时保留既有 `progress`、`settlement` 和顶层 `idempotent` 字段一个发布周期。

Rationale / 原因:

The UI needs one authoritative object for result, chip balance, statistics, and history, while older call sites and tests still depend on the previous response shape.

UI 需要一个权威对象承载结果、筹码余额、统计与历史；同时旧调用点和测试仍依赖旧响应形状。

Rollback / 回滚:

Keep the old fields and stop consuming `round` in the three PR1 table components. The API can continue returning `round` harmlessly.

保留旧字段，并让 PR1 三个桌台组件停止消费 `round`。API 继续返回 `round` 不会破坏旧调用。

## D-2026-07-09-02: No PR1 database migration / PR1 不做数据库迁移

Decision / 决策:

PR1 does not add or require a database migration. If an existing Supabase RPC does not include `round` in its payload, the application loads the persisted round by the same idempotency key.

PR1 不新增或要求数据库迁移。如果既有 Supabase RPC payload 不包含 `round`，应用层用同一幂等键回查已持久化回合。

Rationale / 原因:

The approved plan explicitly keeps PR1 migration-free. Loading by idempotency key preserves the real persisted round ID without changing production schema in this PR.

已批准计划明确 PR1 不做迁移。用幂等键回查可以保留真实持久化回合 ID，同时不在本 PR 改生产 schema。

Rollback / 回滚:

Use the direct settlement path or temporarily keep old UI behavior for affected Supabase environments.

可切换直接结算路径，或在受影响 Supabase 环境临时保留旧 UI 行为。

## D-2026-07-09-03: Blackjack remains PR2 / 21 点保留到 PR2

Decision / 决策:

PR1 does not redesign blackjack. Blackjack remains a separate PR with `member_blackjack_round_states`, versioned actions, command idempotency, refresh recovery, and timeout voiding.

PR1 不重做 21 点。21 点保留为独立 PR，包含 `member_blackjack_round_states`、版本化动作、命令幂等、刷新恢复与超时作废。

Rationale / 原因:

Blackjack is multi-step and requires hidden deck/state persistence; mixing it into PR1 would expand risk and violate the two-PR plan.

21 点是多步流程，需要保存隐藏牌堆与状态；混入 PR1 会扩大风险并违背两 PR 计划。

## D-2026-07-09-04: Browser storage is UI preference only / 浏览器存储仅保存 UI 偏好

Decision / 决策:

Core table `localStorage` may keep stake and chip denominations. It must not store bankroll, final result, history, or cumulative statistics.

核心桌台 `localStorage` 可以保存下注额和筹码面额；不得保存余额、最终结果、历史或累计统计。

Rationale / 原因:

Final gameplay state must recover from server/member round history, not from stale or user-editable browser storage.

最终玩法状态必须从服务端/会员回合历史恢复，而不是从过期或可被用户篡改的浏览器存储恢复。

## D-2026-07-10-01: Blackjack action round ID is the final round ID / 21 点动作回合 ID 同时作为最终回合 ID

Decision / 决策:

The blackjack active state `id` is the `roundId` used by `POST /api/member/game-rounds/[roundId]/actions`. When the hand settles, the same ID is inserted into `member_game_rounds.id` and returned in the final `RoundEnvelope`.

21 点活跃状态的 `id` 即 `POST /api/member/game-rounds/[roundId]/actions` 使用的 `roundId`。当本手结算时，同一个 ID 写入 `member_game_rounds.id` 并作为最终 `RoundEnvelope.roundId` 返回。

Rationale / 原因:

This avoids a split between “state ID” and “settled round ID”, keeps refresh recovery/history mapping simple, and preserves a single canonical ID across UI, actions, final envelope, and replay.

这样可以避免“状态 ID”和“已结算回合 ID”分裂，简化刷新恢复与历史映射，并让 UI、动作、最终 envelope 和重放都使用同一个 canonical ID。

Rollback / 回滚:

If inserting a preselected `member_game_rounds.id` is not viable in a target database, keep `final_round_id` as a separate link and return the final game-round ID in the envelope, while preserving the action state ID only for active commands.

如果目标数据库不能插入预选的 `member_game_rounds.id`，则保留独立 `final_round_id` 关联，并在 envelope 中返回最终 game-round ID；动作状态 ID 只用于活跃命令。

## D-2026-07-10-02: Blackjack start returns active state, actions return final envelope / 21 点开局返回活跃状态，动作返回最终 envelope

Decision / 决策:

For blackjack only, `POST /api/member/game-rounds` creates or restores an active `blackjackRound` view and does not return a settled final `round` unless an already-settled idempotent start is replayed. Final chip/progress/history mutation happens only from the actions endpoint when the state machine reaches `settled`.

仅对 21 点，`POST /api/member/game-rounds` 创建或恢复活跃 `blackjackRound` 视图，不返回已结算最终 `round`，除非重放的是已结算的幂等开局。最终筹码/进度/历史写入只在动作端点把状态机推进到 `settled` 时发生。

Rationale / 原因:

Blackjack is multi-step and must hide the deck/hole card between commands; treating deal as a final generic settlement would recreate the client/server double-result problem.

21 点是多步流程，命令之间必须隐藏牌堆/暗牌；把发牌当作通用最终结算会重新制造客户端/服务端双结果问题。

