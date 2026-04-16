# TaihuCasino Codebase Boundary Plan / TaihuCasino 代码库边界方案

## Purpose / 目的

Clarify which folders belong to the formal product codebase, which folders are legacy transition layers, and which folders are reference archives.

明确哪些目录属于正式产品代码库、哪些目录属于遗留过渡层、哪些目录属于参考档案层。

This document is operational by design: it should guide future cleanup and prevent new work from being mixed into old areas.

这份文档是为实际执行准备的：它用于指导后续整理，并避免新工作再次混入旧区域。

## Current Boundary / 当前边界

### Formal Product Line / 正式产品主线

These folders are the primary development surface now:

当前主要开发面如下：

- `app/`
- `components/`
- `hooks/`
- `lib/`
- `public/`
- `styles/`

Rules:

规则：

- All new product pages should be built in `app/`.  
  所有新的产品页面都应在 `app/` 中开发。
- Reusable UI and page blocks should go into `components/`.  
  可复用的 UI 和页面模块应放入 `components/`。
- Shared logic should go into `lib/` or `hooks/`.  
  共享逻辑应放入 `lib/` 或 `hooks/`。

### Legacy Runtime Layer / 遗留运行层

These folders still serve existing static pages:

这些目录目前仍为旧静态页面提供运行支持：

- `pages/`
- `assets/`

Rules:

规则：

- Do not add new product modules here unless the change is strictly a legacy maintenance fix.  
  除非是严格意义上的遗留维护修复，否则不要在这里新增产品模块。
- Treat this area as a transition layer that should gradually shrink over time.  
  应将这一层视为会逐步收缩的过渡区域。

### Archive And Reference Layer / 档案与参考层

These folders are not part of the formal runtime product surface:

这些目录不属于正式运行中的产品主线：

- `prototypes/`
- `docs/notes/`

Rules:

规则：

- `prototypes/` is for reference material only.  
  `prototypes/` 仅用于参考。
- No new production features should start here.  
  不应在这里起步开发新的正式功能。
- Content may be copied out into React components, but should not continue evolving here long-term.  
  内容可以被提炼进 React 组件，但不应继续长期在此演化。

## Folder Responsibilities / 目录职责

### `app/`

Use for:

适用内容：

- all new routes / 所有新路由
- all migrated game pages / 所有迁移后的游戏页面
- page-level layout composition / 页面级布局组织

Do not use for:

不适合放置：

- generic UI primitives / 通用 UI 基础组件
- duplicated static HTML experiments / 重复的静态 HTML 试验页

### `components/`

Use for:

适用内容：

- shared page sections / 共享页面区块
- game route shells / 游戏路由壳层
- headers, toggles, cards, tables, panels / 头部、切换器、卡片、表格、面板
- UI system components / UI 系统组件

Do not use for:

不适合放置：

- one-off archived prototype code / 一次性归档原型代码

### `pages/`

Current role:

当前角色：

- legacy playable HTML pages still in service  
  仍在服务中的旧版可运行 HTML 页面

Future role:

未来角色：

- temporary compatibility area only  
  仅作为临时兼容区存在

Policy:

策略：

- Maintain only if needed for currently live legacy flows.  
  仅在当前遗留流程仍然需要时维护。
- Every substantial improvement should be evaluated for migration into `app/`.  
  所有较大的改动都应优先评估是否迁入 `app/`。

### `assets/`

Current role:

当前角色：

- CSS, JS, and images used by legacy static pages  
  遗留静态页面使用的 CSS、JS 与图片资源

Future role:

未来角色：

- support legacy pages until each dependency is replaced by `public/`, `app/`, or `components/`  
  在这些依赖被 `public/`、`app/` 或 `components/` 替代前，继续为遗留页面提供支持

Policy:

策略：

- New assets for React pages should prefer `public/`.  
  React 页面新增资源优先放在 `public/`。
- New page logic should not be added to `assets/js/` for formal product work.  
  正式产品的新页面逻辑不应继续写入 `assets/js/`。

### `prototypes/`

Current role:

当前角色：

- archive of homepage explorations and exported static concept versions  
  首页探索稿与导出静态概念版本的档案库

Policy:

策略：

- Keep for historical reference.  
  保留用于历史参考。
- No production logic should depend on this directory.  
  正式产品逻辑不应依赖该目录。

## Cleanup Phases / 整理阶段

### Phase 1: Boundary Discipline / 第一阶段：边界纪律

Status: start now

状态：立即开始

- Stop adding new features to `pages/` and `assets/`.  
  停止往 `pages/` 和 `assets/` 添加新功能。
- Treat `app/` as the only destination for new user-facing product pages.  
  将 `app/` 视为所有新用户页面的唯一正式落点。
- Keep `prototypes/` read-only except for documentation or archiving work.  
  除文档整理和归档外，`prototypes/` 保持只读思维。

### Phase 2: Migrate Route By Route / 第二阶段：按路由逐步迁移

Recommended order:

推荐顺序：

1. Replace `app/games/[slug]` placeholder pages with formal React game route shells.  
   将 `app/games/[slug]` 的占位页替换为正式 React 游戏路由骨架。
2. Identify which files in `pages/` are still actively needed.  
   梳理 `pages/` 中哪些文件仍然活跃需要。
3. Move reusable logic from legacy JS/CSS into React components and shared theme tokens.  
   把遗留 JS/CSS 中可复用的逻辑提炼进 React 组件和共享主题 token。
4. Retire equivalent legacy pages one by one after migration.  
   迁移完成后逐个下线对应遗留页面。

### Phase 3: Collapse The Legacy Layer / 第三阶段：收缩遗留层

Only after enough migration is complete:

只有在足够多内容迁移完成后再做：

- reduce `pages/` to the truly still-needed files  
  将 `pages/` 收缩到真正还需要的文件
- reduce `assets/` to the truly still-needed files  
  将 `assets/` 收缩到真正还需要的文件
- optionally rename or document remaining legacy areas more explicitly  
  视情况对剩余遗留区域做更明确的命名或文档标注

## Recommended Near-Term Actions / 近期推荐动作

### Highest-Value Next Action / 当前最有价值的下一步

Build real route shells in `app/games/[slug]` so the main user journey is fully inside the formal product layer.

先把 `app/games/[slug]` 做成正式路由骨架，让主要用户路径完整落在正式产品层中。

### After That / 然后再做

- audit each file in `pages/` / 逐个审计 `pages/` 中的文件
- classify as `migrate`, `keep temporarily`, or `archive` / 标记为“迁移”“临时保留”或“归档”
- audit each file in `assets/` / 逐个审计 `assets/` 中的文件
- map every dependency to the page that still needs it / 把每个依赖映射到仍在使用它的页面

## Non-Goals For Now / 当前不做的事

Do not do these immediately:

当前不要立即做这些事：

- mass-moving all legacy files just to make the tree look cleaner  
  不要只是为了看起来整齐就大规模搬动遗留文件
- converting to monorepo structure  
  不要现在就转 monorepo
- renaming runtime folders before migration responsibility is clear  
  在迁移责任未清晰前，不要急着重命名运行目录

The goal is clarity first, then controlled migration.

目标是先建立清晰边界，再进行可控迁移。
