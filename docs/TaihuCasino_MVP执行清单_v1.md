# TaihuCasino MVP Execution Checklist v1 / TaihuCasino MVP 执行清单 v1

Date / 日期：`2026-04-09`

This checklist converts the MVP roadmap into near-term executable checks.

本清单用于把 MVP 路线图转化为近期可执行的检查项。

## 1. Project Consolidation / 项目收敛

- Select the main MVP pages.  
  选定 MVP 主线页面。
- Mark non-mainline pages clearly.  
  明确标记非主线页面。
- Standardize the home entry expression.  
  统一首页入口表达。
- Standardize the member entry location.  
  统一会员入口位置。
- Clarify boundaries between shared scripts and page-specific scripts.  
  梳理公共脚本与页面专属脚本边界。

## 2. Account And Membership / 账户与会员

- Auth configuration can switch environments.  
  Auth 配置支持环境切换。
- Login works.  
  登录可用。
- Logout works.  
  登出可用。
- Callback flow works.  
  回调可用。
- Session can recover after refresh.  
  刷新后会话可恢复。
- Protected gameplay pages can enforce access control.  
  受保护玩法页可进行访问控制。

## 3. Supabase Data Loop / Supabase 数据闭环

- Create user profile structure.  
  建立用户资料结构。
- Create wallet structure.  
  建立钱包结构。
- Create gameplay progress structure.  
  建立玩法进度结构。
- Create purchase record structure.  
  建立购买记录结构。
- Create ad reward event structure.  
  建立广告奖励事件结构。
- Create session event structure.  
  建立会话事件结构。

## 4. Four Core Games / 四个核心玩法接入

- Baccarat connects to the unified wallet.  
  百家樂接入统一钱包。
- Roulette connects to the unified wallet.  
  轮盘接入统一钱包。
- Dice connects to the unified wallet.  
  骰子接入统一钱包。
- Blackjack connects to the unified wallet.  
  21 点接入统一钱包。
- All four games can save basic progress.  
  四个玩法都能保存基础进度。
- All four games can return to the lobby.  
  四个玩法都能回到大厅。

## 5. Monetization Loop / 变现闭环

- Rewarded ad path is available.  
  激励广告奖励路径可用。
- Loss recovery ad path is available.  
  失败恢复广告路径可用。
- Product list exists.  
  商品列表可用。
- Purchase crediting works.  
  购买到账可用。
- Purchase failure handling works.  
  购买失败处理可用。
- Wallet entry and rollback are unified.  
  钱包统一入账与回滚。

## 6. Experiment Readiness / 实验准备

- Track registration count.  
  记录注册数。
- Track login success rate.  
  记录登录成功率。
- Track game start rate.  
  记录玩法开局率。
- Track round completion rate.  
  记录每局完成率。
- Track ad completion rate.  
  记录广告完成率。
- Track first purchase rate.  
  记录首购率。
- Track save recovery success rate.  
  记录恢复存档成功率。

## 7. Acceptance Criteria / 验收口径

The MVP is testable only when all conditions below are met.

满足以下条件后，MVP 才算具备可实验基础。

- Users can register, log in, and log out.  
  用户可以注册、登录、登出。
- A unified wallet works across the four core games.  
  统一钱包在四个玩法之间生效。
- Core profile and progress can recover.  
  核心资料与进度可以恢复。
- Ads and IAP each have at least one real testable path.  
  广告和 IAP 至少各有一条真实可测路径。
- Key behavior events can be tracked.  
  关键行为事件可追踪。
- Page experience does not violate the product charter boundaries and principles.  
  页面体验不违反产品宪章中的边界与原则。
