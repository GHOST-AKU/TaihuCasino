# Getting Started / 快速开始

Use this page as the quick-start entry for local development and routine checks.

本页用于本地开发启动与日常检查的快速入口。

## Environment / 环境与命令

1. Install dependencies / 安装依赖
   ```powershell
   corepack pnpm install
   ```
2. Start dev server / 启动开发服务器
   ```powershell
   corepack pnpm dev
   ```
3. Run the combined CI gate / 运行组合 CI 检查
   ```powershell
   corepack pnpm run ci
   ```

## Where To Work / 开发位置

- Product routes / 产品路由: `app/`
- Shared UI/components / 共享 UI 和组件: `components/`
- Utility and shared logic / 工具与共享逻辑: `lib/`
- Legacy runtime, migration target / 遗留运行层与迁移目标: `pages/`, `assets/`

## References / 参考文档

- [README](../../README.md)
- [Project Structure](../PROJECT_STRUCTURE.md)
- [Deployment Readiness](../DEPLOYMENT_READINESS.md)
