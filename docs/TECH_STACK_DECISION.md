# Tech Stack Decision / 技术栈决议

## Decision / 决议

As of `2026-04-14`, the formal frontend stack for TaihuCasino is:

截至 `2026-04-14`，TaihuCasino 的正式前端技术栈确定为：

- `React`
- `Next.js`
- `TypeScript`

## What This Decision Means In Practice / 这项决议在实践中的含义

This is not only a written decision. It has already been reflected in the repository structure.

这不仅是文档上的决定，也已经落到了仓库结构中。

- The formal page entry is now the root-level `app/` directory.  
  正式页面入口现在是根目录下的 `app/`。
- Shared components, hooks, helper functions, and formal assets also live in the root project structure.  
  共享组件、hooks、辅助函数与正式资源也已经进入根目录主工程。
- Older static homepage experiments have been moved into `prototypes/`.  
  旧的静态首页实验稿已迁移到 `prototypes/`。
- Existing legacy runtime content in `pages/` and `assets/` is still retained as a transition layer.  
  `pages/` 与 `assets/` 中的遗留运行内容仍保留为过渡层。

## Why This Stack / 为什么选择这套栈

Compared with continuing to push multiple standalone HTML prototypes, `React + Next.js` is a better fit for the future of this project.

相比继续推进多个独立 HTML 原型，`React + Next.js` 更适合本项目的后续演进。

- easier componentization and reuse  
  更容易组件化与复用
- better support for complex interactions and state  
  更适合承接复杂交互与状态管理
- cleaner routing expansion and page integration  
  更利于路由扩展与页面整合
- better long-term maintainability and engineering collaboration  
  更适合长期维护和工程化协作

## Current Execution Rules / 当前执行规则

1. New features should be developed in the root Next.js project by default.  
   新功能默认在根目录 Next.js 工程中开发。
2. Prototype pages are for reference and comparison, not for continued mainline feature accumulation.  
   原型页面只用于参考和对照，不再作为主线持续堆积功能。
3. Existing playable legacy pages may remain in `pages/` temporarily, but the target is still gradual migration to React / Next.js.  
   现有可运行的遗留页面可以暂时保留在 `pages/`，但目标仍是逐步迁移到 React / Next.js。
4. If useful content from old solutions is absorbed, it should be migrated into React pages or components first.  
   如需吸收旧方案内容，应优先迁移为 React 页面或组件。
