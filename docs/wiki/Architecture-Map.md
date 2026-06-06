# Architecture Map / 架构地图

TaihuCasino currently runs a dual-track architecture: formal Next.js product line + legacy static runtime during migration.

TaihuCasino 当前是双轨架构：正式 Next.js 产品线 + 迁移期遗留静态运行层。

## Core Boundaries / 核心边界

- `app/`: formal App Router entry and APIs / 正式 App Router 入口和 API
- `components/`: shared UI and page shells / 共享 UI 和页面外壳
- `lib/`: data access, auth helpers, shared logic / 数据访问、认证辅助和共享逻辑
- `supabase/migrations/`: schema and database evolution / 数据库结构与迁移历史
- `pages/`, `assets/`: legacy runtime kept for migration compatibility / 为迁移兼容保留的遗留运行层

## Current Hot Paths / 当前关键路径

- Auth flow: login/register/oauth/callback / 认证流程：登录、注册、OAuth、回调
- Member APIs: profile/settings/progress/wallet/table sessions / 会员 API：资料、设置、进度、钱包、桌台 session
- Game routes: baccarat/blackjack/roulette/dice and related settlements / 游戏路由：百家乐、二十一点、轮盘、骰子及相关结算

## Migration Direction / 迁移方向

- New product work goes to `app/` and shared React components. / 新产品工作进入 `app/` 和共享 React 组件。
- Legacy pages are maintained only as temporary compatibility layer. / 遗留页面仅作为临时兼容层维护。

## References / 参考文档

- [Codebase Boundary Plan](../CODEBASE_BOUNDARY_PLAN.md)
- [Project Structure Clean](../PROJECT_STRUCTURE_CLEAN.md)
- [Supabase Auth Schema](../SUPABASE_AUTH_SCHEMA.md)
