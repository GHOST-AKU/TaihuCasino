# TaihuCasino 项目结构

TaihuCasino 现已从“多份静态页面并存”的状态，整理为“Next.js 正式主线 + 静态游戏页过渡 + 原型归档”的结构。

## 正式工程结构

```text
TaihuCasino/
|-- app/                  # Next.js App Router 页面入口
|-- components/           # React 组件
|-- hooks/                # hooks
|-- lib/                  # 工具函数
|-- pages/                # 现有静态游戏页（迁移前继续保留）
|-- assets/               # 现有静态游戏页依赖资源
|-- public/               # 正式静态资源
|-- styles/               # 正式样式资源
|-- docs/                 # 项目文档
|-- prototypes/           # 旧原型归档
|-- package.json
`-- tsconfig.json
```

## prototypes 结构

```text
prototypes/
|-- legacy-static/        # 旧首页/入口原型归档
|   |-- home*.html
|   |-- index.html
`-- vercel-ver-static/    # 从 Vercel 风格方案导出的纯静态版
```

## 当前约定

- 正式产品开发在根目录 Next.js 工程中进行
- 当前已有游戏仍由根目录 `pages/` + `assets/` 提供
- `prototypes/` 只用于参考、对照、内容迁移和历史归档
- 后续如果继续吸收旧页面内容，应优先拆成 React 页面或组件
- 不再把新的首页/入口类功能直接加回 `home*.html` 或 `index.html`

## 后续建议

1. 逐步把根目录 `pages/` 中的游戏页面迁移到 `app/`
2. 把旧静态页里的可复用视觉语言沉淀到 `components/` 与 `app/globals.css`
3. 等主线稳定后，再决定是否进一步细分为 `apps/web` 之类的 monorepo 结构
