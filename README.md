# TaihuCasino

TaihuCasino 已整理为一个以 `React + Next.js` 为正式主线、同时保留现有静态游戏页过渡层的前端项目。

这次结构收敛做了两件核心事情：

- 把原 `vercel ver/` 中的 Next.js 应用内容吸收到了仓库正式根结构
- 把旧的静态 `home*` 与 `index` 统一归档到 `prototypes/`
- 保留根目录 `pages/` 与 `assets/`，因为当前游戏内容仍依赖它们运行

## 当前技术栈

- `React 19`
- `Next.js 16`
- `TypeScript`
- `Tailwind CSS 4`

## 当前正式目录

```text
.
|-- app/                  # Next.js App Router 页面
|-- components/           # React 组件
|-- hooks/                # 自定义 hooks
|-- lib/                  # 工具函数
|-- pages/                # 现有静态游戏页（过渡保留）
|-- assets/               # 现有静态游戏资源（过渡保留）
|-- public/               # 正式静态资源
|-- styles/               # 正式样式资源
|-- prototypes/           # 历史静态原型与导出版
|-- docs/                 # 项目文档
|-- package.json
`-- README.md
```

## prototypes 说明

旧静态原型没有被删除，而是被归档到：

- `prototypes/legacy-static/`
- `prototypes/vercel-ver-static/`

其中 `prototypes/legacy-static/` 里保留了原来的：

- `home*.html`
- `index.html`

这样可以继续作为设计参考、内容迁移素材或对照版本，但它们不再是正式开发主线。
当前真正承载已有游戏内容的 `pages/` 和 `assets/` 仍保留在根目录，作为迁移过渡层继续存在。

## 开发方式

1. 安装依赖

```bash
pnpm install
```

2. 启动开发环境

```bash
pnpm dev
```

3. 生产构建

```bash
pnpm build
pnpm start
```

## 开发约定

- 新页面默认放在 `app/`
- 可复用 UI 与模块默认沉淀到 `components/`
- 新的首页与新模块不再继续堆到根目录静态 HTML 文件
- 现有游戏页仍可在 `pages/` 中维护，但目标是逐步迁移到 Next.js
- 旧静态方案如需保留，优先迁移到 React 组件，而不是继续复制 HTML

## 相关文档

- `docs/PROJECT_STRUCTURE.md`
- `docs/TECH_STACK_DECISION.md`
- `docs/THEME_SYSTEM.md`

## License

- `LICENSE`
- `Surreal Chaos License v0.1.md`
