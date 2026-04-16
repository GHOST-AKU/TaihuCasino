# Subagent Peer Review / Subagent 互审意见

## Date / 日期

- `2026-04-05`

## Scope / 范围

- `pages/dice.html`
- `pages/cocktail-bar.html`
- `pages/blackjack.html`

## Review A On B: `cocktail-bar.html` / A 审 B：`cocktail-bar.html`

Reviewer / 审阅者：Hume

### Main Findings / 主要问题

- High: inventory quantity updates trigger full-page rerenders during input, which can cause focus loss and poor typing experience.  
  高：库存数量输入过程中触发整页重渲染，容易导致失焦和连续输入困难。
- Medium: the “clear current selection” action actually resets to the first cocktail instead of truly clearing state.  
  中：“清空当前选择” 实际行为更像恢复到第一款酒，而不是真正清空。
- Medium: failed mixes still calculate and display scores, which may create contradictory business feedback.  
  中：缺料失败时仍然计算并显示评分，容易出现业务语义矛盾。
- Medium: some successful but low-score results still trigger failure-style shake animation.  
  中：部分成功但低分的结果仍触发失败式 shake 动画。
- Medium: date rollover is only checked on load, not while the page stays open across midnight.  
  中：跨天逻辑只在加载时检查，页面常驻跨零点时不会自动切日。
- Low: render and save calls are scattered, which increases maintenance risk.  
  低：渲染与保存调用链过于分散，后续维护副作用风险较高。
- Low: the `max=99` inventory limit exists in UI only, but not in the logic layer.  
  低：库存 `max=99` 只在 UI 层限制，逻辑层未同步约束。

### Recommendations / 建议

1. Make inventory input update locally or defer full rerender until `change` / `blur`.  
   将库存输入改为局部更新，或延迟到 `change` / `blur` 再整页渲染。
2. Align button text with real behavior, or implement real clearing logic.  
   让按钮文案和真实行为一致，或改成真正的清空逻辑。
3. Show `--` or “not served” when the drink cannot be made.  
   当无法出杯时，将评分显示为 `--` 或 “未出杯”。
4. Decouple business outcome from animation feedback.  
   让业务结果与动效反馈解耦。
5. Add a timer-based day rollover check.  
   增加基于定时检查的跨天切日逻辑。

## Review B On A: `dice.html` / B 审 A：`dice.html`

Reviewer / 审阅者：Nietzsche

### Main Findings / 主要问题

- High: bets are not frozen during the rolling process, so values can still change before settlement.  
  高：掷骰过程中下注未冻结，结算前仍可能被修改。
- Medium: the initial fund minimum in HTML and JS validation are inconsistent.  
  中：HTML 与 JS 对初始资金的最小值约束不一致。
- Medium: history display is capped visually, but the underlying array is not trimmed.  
  中：历史仅限制显示数量，但底层数组没有裁剪。
- Medium: the panel mixes per-round EV and cumulative ROI, which hurts interpretability.  
  中：面板混用了单局 EV 和累计 ROI，解释性不足。
- Low: chip and bet interactions use `div` semantics, which hurts accessibility.  
  低：筹码和下注交互使用 `div`，可访问性较弱。
- Low: mobile input widths may become cramped on narrower devices.  
  低：窄屏设备上下注输入区可能拥挤。
- Low: no local persistence, so refresh resets funds and history.  
  低：缺少本地持久化，刷新即丢失资金和历史。

### Recommendations / 建议

1. Freeze a snapshot of bets once rolling starts and settle only from the snapshot.  
   一旦开始掷骰，立即冻结下注快照，并仅基于快照结算。
2. Unify validation rules between HTML and JS.  
   统一 HTML 和 JS 的输入校验规则。
3. Add a capacity limit for stored history.  
   为历史记录增加容量上限。
4. Clarify metric definitions in the panel.  
   在面板上明确各统计指标的口径。
5. Replace interactive `div`s with `button`s or add equivalent keyboard support.  
   将可交互 `div` 改为 `button`，或补齐等效键盘支持。

## Joint Review: `blackjack.html` / 双审：`blackjack.html`

Reviewers / 审阅者：Hume + Nietzsche

### Shared High-Priority Issues / 共识高优先级问题

- Bets can still change while a round is in progress.  
  高优先级：回合进行中仍可修改下注。
- Settlement does not rely on a frozen betting snapshot.  
  高优先级：结算没有基于冻结下注快照。

### Other Findings / 其他问题

- Medium: core rules such as S17/H17 and dealer draw behavior need clearer documentation.  
  中：S17/H17、庄家补牌等规则说明需要更清晰。
- Medium: some blackjack settlement cases are not documented clearly enough.  
  中：部分 blackjack 结算规则说明不够清楚。
- Medium: metric wording in the panel is easy to misread.  
  中：面板中的统计口径容易引起误解。
- Low: the betting area becomes cramped on mobile.  
  低：移动端下注区偏拥挤。
- Low: the history label `BJ` can obscure win/loss clarity.  
  低：历史中的 `BJ` 标记会覆盖一部分输赢表达。

### Recommendations / 建议

1. Introduce a strict round state machine and unified bet locking.  
   引入严格的回合状态机，并统一锁定下注。
2. Freeze bets at the beginning of `deal()` and settle only against that snapshot.  
   在 `deal()` 开始时冻结下注，并仅基于快照结算。
3. Document rules clearly and ensure code behavior matches them.  
   明确规则说明，并确保代码行为与文档一致。
4. Distinguish current bet amount from cumulative betting metrics.  
   区分当前下注额与累计下注指标。
5. Improve mobile layout and interaction semantics.  
   优化移动端布局与交互语义。

## Overall Priority / 汇总优先级

1. Fix the “bets can still change during the round” issue across all reviewed pages.  
   优先修复所有相关页面的“回合中仍可改注”问题。
2. Unify input validation between HTML constraints and JS logic.  
   统一 HTML 与 JS 的输入约束。
3. Standardize metric wording and panel interpretation.  
   统一统计口径与面板解释。
4. Improve accessibility and mobile interaction quality.  
   改善可访问性与移动端交互质量。
