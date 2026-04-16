# TaihuCasino Project Structure / TaihuCasino 项目结构

> This is the legacy structure note. For the current concise reference, prefer `PROJECT_STRUCTURE_CLEAN.md`.
>
> 这是旧版结构说明。当前简明版本请优先参考 `PROJECT_STRUCTURE_CLEAN.md`。

TaihuCasino has been reorganized from “multiple static pages living side by side” into a clearer structure: a formal Next.js mainline, static game pages kept during migration, and archived prototypes.

TaihuCasino 已经从“多份静态页面并存”的状态，整理为更清楚的结构：Next.js 正式主线、迁移期间保留的静态游戏页面，以及已归档的原型。

## Formal Engineering Structure / 正式工程结构

```text
TaihuCasino/
|-- app/                  # Next.js App Router entry pages / Next.js App Router 页面入口
|-- components/           # React components / React 组件
|-- hooks/                # React hooks
|-- lib/                  # Utilities / 工具函数
|-- pages/                # Existing static game pages kept before migration / 迁移前保留的静态游戏页
|-- assets/               # Assets used by existing static game pages / 现有静态游戏页依赖资源
|-- public/               # Formal static assets / 正式静态资源
|-- styles/               # Formal style resources / 正式样式资源
|-- docs/                 # Project documentation / 项目文档
|-- prototypes/           # Archived prototypes / 旧原型归档
|-- package.json
`-- tsconfig.json
```

## Prototypes Structure / prototypes 结构

```text
prototypes/
|-- legacy-static/        # Archived legacy homepage and entry prototypes / 旧首页与入口原型归档
|   |-- home*.html
|   |-- index.html
`-- vercel-ver-static/    # Pure static export from the Vercel-style direction / Vercel 风格方案导出的纯静态版本
```

## Current Agreements / 当前约定

- Formal product development happens in the root Next.js project.
  正式产品开发在根目录 Next.js 工程中进行。
- Existing games are still served by root `pages/` and `assets/` until migration.
  当前已有游戏仍由根目录 `pages/` 与 `assets/` 提供，直到完成迁移。
- `prototypes/` is for reference, comparison, content migration, and historical archive only.
  `prototypes/` 只用于参考、对照、内容迁移和历史归档。
- If legacy page content is absorbed later, it should first be split into React pages or components.
  后续如继续吸收旧页面内容，应优先拆成 React 页面或组件。
- Do not add new homepage or entry functionality directly into `home*.html` or `index.html`.
  不再把新的首页或入口类功能直接加回 `home*.html` 或 `index.html`。

## Follow-Up Recommendations / 后续建议

1. Gradually migrate game pages from root `pages/` into `app/`.
   逐步把根目录 `pages/` 中的游戏页面迁移到 `app/`。
2. Move reusable visual language from old static pages into `components/` and `app/globals.css`.
   把旧静态页里的可复用视觉语言沉淀到 `components/` 和 `app/globals.css`。
3. After the mainline stabilizes, decide whether to further split into a monorepo structure such as `apps/web`.
   等主线稳定后，再决定是否进一步细分为 `apps/web` 之类的 monorepo 结构。
