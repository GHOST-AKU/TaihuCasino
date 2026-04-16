# TaihuCasino Two-Person Team Development Plan v1 / TaihuCasino 两人团队开发计划 v1

Status / 状态：Execution Draft / 执行草案  
Date / 日期：`2026-04-09`  
Audience / 适用对象：TaihuCasino two-person team / TaihuCasino 两人团队

## 1. Plan Goal / 计划目标

This plan turns the current static prototype repository into a testable web game MVP.

本计划用于把当前静态原型仓库推进为一个可上线实验的 web game MVP。

The first goal is not to build a complete commercial product. The first goal is to create a minimum testable product with:

首轮目标不是做成完整商业产品，而是完成一个具备以下能力的最小可实验版本：

- one unified casino lobby entry  
  统一赌场大厅入口
- four core games that can be entered, played, and settled  
  四个核心玩法可进入、可游玩、可结算
- usable member registration and login  
  会员注册登录可用
- basic profile, wallet, and gameplay progress persistence  
  用户基础资料、钱包与游戏进度可保存
- a minimal rewarded-ad and IAP loop  
  激励广告与 IAP 的最小可验证闭环
- trackable events for the first experiment cycle  
  支持首轮实验与复盘的数据事件

## 2. Current Foundation / 当前基础

The repository already contains:

当前仓库已经具备：

- formal Next.js app structure in `app/`  
  `app/` 中的正式 Next.js 应用结构
- shared React components in `components/`  
  `components/` 中的共享 React 组件
- legacy playable pages in `pages/`  
  `pages/` 中的遗留可运行页面
- legacy assets in `assets/`  
  `assets/` 中的遗留资源
- documentation under `docs/`  
  `docs/` 中的项目文档

Main current gaps:

当前主要缺口：

- game pages are not fully migrated into the formal React layer  
  游戏页面尚未完整迁移到正式 React 层
- wallet and save logic are not unified across games  
  钱包与保存逻辑尚未跨玩法统一
- member and data systems are still incomplete  
  会员与数据系统仍未完整闭环
- legacy static pages still carry important runtime behavior  
  遗留静态页面仍承载重要运行行为

## 3. Technical Path / 技术路径

Default path for the first MVP:

首轮 MVP 默认技术路径：

- Authentication: Auth0 SPA  
  登录认证：Auth0 SPA
- Member entry: current member counter flow, then migrate into Next.js  
  会员入口：先保留当前会员柜台流程，再迁移进 Next.js
- Cloud data: Supabase  
  云端数据：Supabase
- Frontend: React + Next.js  
  前端形态：React + Next.js
- First games: Baccarat, Roulette, Dice, Blackjack  
  首轮玩法：百家樂、轮盘、骰子、21 点
- First monetization: rewarded ads + small IAP  
  首轮变现：激励广告 + 小额 IAP

Out of scope for the first MVP:

首轮 MVP 暂不包含：

- complex membership progression  
  复杂会员成长系统
- multiplayer competition  
  多人对战
- tournament systems  
  赛事系统
- social systems  
  社交系统
- large-scale shop inventory  
  大规模商城商品
- high-complexity AI or game variants  
  高复杂度 AI 或玩法变体扩展

## 4. Delivery Standards / 交付标准

### Unified Lobby / 统一大厅

- Home is a real product lobby, not just prototype navigation.  
  首页应是产品大厅，而不只是原型导航。
- Member status, navigation, game entry, and wallet information should be consistently expressed.  
  会员状态、入口导航、玩法跳转与钱包信息应具备统一表达。
- Unauthenticated users should be guided to member login when entering protected gameplay.  
  未登录用户进入受保护玩法时，应被引导到会员登录。

### Four Games / 四个玩法

Each core game should:

每个核心玩法应具备：

- be enterable / 可进入
- complete at least one full round / 至少完成一轮完整游戏
- settle through the unified wallet / 通过统一钱包结算
- record basic statistics / 记录基础统计
- save and recover recent state / 保存并恢复最近状态
- return to the lobby / 返回大厅

### Member System / 会员系统

Minimum requirements:

最低要求：

- registration and login / 注册与登录
- session recovery / 会话恢复
- logout / 登出
- basic user profile / 基础用户资料
- member status display / 会员状态展示
- recent login and recent gameplay summary / 最近登录与最近游玩摘要

### Save And Sync / 保存与同步

At minimum, persist:

至少保存：

- user profile / 用户资料
- wallet balance / 钱包余额
- basic gameplay stats / 基础玩法统计
- recent gameplay state / 最近游戏状态
- key preference settings / 关键偏好设置

Cloud data should be primary. Local cache is only a recovery aid.

云端数据为主，本地缓存仅作为快速恢复辅助。

### Monetization Loop / 变现闭环

The first monetization version should be minimal and testable.

首轮变现只做最小可验证版本。

- rewarded ads cover reward claim and loss recovery  
  激励广告至少覆盖奖励领取与失败恢复
- IAP includes only a small number of standard products  
  IAP 只上线少量标准商品
- all rewards, deductions, and credits pass through the unified wallet  
  所有奖励、扣费与到账必须经过统一钱包逻辑
- no design should create “guaranteed win”, “cash income”, or predatory recovery illusions  
  不允许出现“必赢”“现金收益”“保底翻盘”等设计幻觉

## 5. Phased Plan / 分阶段计划

### Phase 0: Project Convergence / 阶段 0：项目收敛

Goal: move from page collection to unified product structure.

目标：从“页面集合”收敛到“统一产品结构”。

Deliverables:

交付项：

- confirm the main lobby route  
  确认主大厅路由
- confirm the member entry  
  确认会员入口
- confirm first core game routes  
  确认首轮核心玩法路由
- classify candidate and archive pages  
  标记候选页与归档页
- define shared CSS, JS, and page-specific boundaries  
  明确公共 CSS、JS 与页面专属逻辑边界

### Phase 1: Unified Frontend Flow / 阶段 1：统一前端用户流

Goal: create a walkable unified user journey.

目标：形成可走通的统一用户流程。

Deliverables:

交付项：

- product lobby expression  
  产品化大厅表达
- unified navigation and member entry  
  统一导航与会员入口
- shared session state interface  
  共享会话状态接口
- shared wallet state interface  
  共享钱包状态接口
- shared access guard  
  共享访问守卫
- shared event tracking interface  
  共享事件埋点接口

### Phase 2: Auth0 + Supabase Loop / 阶段 2：Auth0 + Supabase 数据闭环

Goal: connect login, profile, wallet, and progress to a real data chain.

目标：把登录、资料、钱包、进度接成真实数据链路。

Deliverables:

交付项：

- complete Auth0 login, callback, logout, and session recovery  
  完成 Auth0 登录、回调、登出与会话恢复
- create Supabase user, wallet, progress, event, purchase, and ad reward tables  
  建立 Supabase 用户、钱包、进度、事件、购买、广告奖励表
- initialize profile and wallet on first login  
  首次登录初始化资料与钱包
- define local cache and cloud sync strategy  
  落地本地缓存与云端同步策略

### Phase 3: Four Games Integration / 阶段 3：四玩法统一接线

Goal: connect all four games to the unified product system.

目标：让四个玩法真正接入统一产品系统。

Deliverables:

交付项：

- wallet integration for each game  
  每个玩法接入钱包
- progress saving for each game  
  每个玩法接入进度保存
- round start, settlement, result, and balance events  
  记录开局、结算、结果、余额变化事件
- return path to lobby  
  提供返回大厅路径

### Phase 4: Ads And IAP Loop / 阶段 4：广告与 IAP 闭环

Goal: verify monetization feasibility without breaking the product charter.

目标：验证变现可行性，同时不破坏产品宪章。

Deliverables:

交付项：

- rewarded ad main path  
  激励广告主路径
- ad reward crediting  
  广告奖励入账
- loss recovery ad placement  
  失败恢复广告位
- standard product list  
  标准商品列表
- purchase success, failure, and cancellation handling  
  购买成功、失败、取消处理
- purchase record and wallet ledger updates  
  购买记录与钱包账本写入

### Phase 5: Experiment Release / 阶段 5：实验版打磨与小范围上线

Goal: make the product ready for a small real-user experiment.

目标：让产品具备小范围真实用户实验条件。

Deliverables:

交付项：

- member summary in lobby  
  大厅会员摘要
- recent gameplay summary  
  最近游玩信息
- basic empty and error states  
  基础空状态与错误提示
- unified loading and failure feedback  
  统一加载与失败反馈
- key metrics instrumentation  
  关键指标埋点
- first release checklist  
  首轮实验版发布清单

## 6. Role Split / 角色分工

Product owner responsibilities:

产品负责人负责：

- charter alignment / 宪章对齐
- game rule tradeoffs / 玩法规则取舍
- interface and copy direction / 界面与文案方向
- ad and IAP product design / 广告与 IAP 商品设计
- testing feedback and version judgment / 测试反馈与版本判断

Engineering owner responsibilities:

工程负责人负责：

- technical structure convergence / 技术结构收敛
- Auth0 and Supabase integration / Auth0 与 Supabase 接线
- shared state modules / 公共状态模块
- four-game integration / 四玩法统一接入
- monetization loop implementation / 变现闭环实现
- release readiness / 上线准备

## 7. Success Criteria / 成功标准

The first development cycle is not complete unless the team can answer “yes” to these questions:

如果以下问题不能明确回答“是”，则首轮开发不视为完成：

- Can users register and log in?  
  用户能注册并登录吗？
- Can login state persist across pages?  
  登录状态能跨页面保持吗？
- Can wallet and progress save and recover?  
  钱包与进度能保存并恢复吗？
- Can all four games connect to the unified system?  
  四个玩法都能接入统一系统吗？
- Can ads and IAP form a minimal testable loop?  
  广告和 IAP 能形成最小可验证闭环吗？
- Can the team observe the key metrics needed for the first experiment?  
  团队能看到首轮实验所需的关键数据吗？
