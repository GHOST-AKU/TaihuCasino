# Project Structure Clean Reference / 项目结构清晰版说明

## Runtime Product / 正式运行产品层

- `app/` - formal Next.js App Router pages  
  `app/` - 正式的 Next.js App Router 页面
- `components/` - shared React components and UI system  
  `components/` - 共享 React 组件与 UI 系统
- `hooks/` - shared hooks  
  `hooks/` - 共享 hooks
- `lib/` - shared utilities and data helpers  
  `lib/` - 共享工具函数与数据辅助逻辑
- `public/` - static assets for the formal app  
  `public/` - 正式应用使用的静态资源
- `styles/` - formal style resources  
  `styles/` - 正式样式资源

## Legacy Runtime / 遗留运行层

- `pages/` - legacy static runtime pages still in service  
  `pages/` - 仍在使用中的旧版静态运行页面
- `assets/` - CSS, JS, and images used by the legacy runtime  
  `assets/` - 遗留运行层使用的 CSS、JS 和图片资源

## Archive And Reference / 档案与参考层

- `prototypes/` - archived prototype explorations and exported concepts  
  `prototypes/` - 已归档的原型探索与导出概念稿
- `docs/notes/` - temporary notes and working documents  
  `docs/notes/` - 临时笔记与过程性工作文档

## Rule Of Thumb / 快速判断规则

- New product work goes to `app/`.  
  新的产品功能优先进入 `app/`。
- Shared UI goes to `components/`.  
  共享 UI 优先进入 `components/`。
- Legacy fixes only go to `pages/` and `assets/`.  
  遗留修复才进入 `pages/` 和 `assets/`。
- Reference work stays in `prototypes/`.  
  参考性质内容保留在 `prototypes/`。
