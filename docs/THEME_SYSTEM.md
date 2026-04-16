# TaihuCasino Theme System / TaihuCasino 主题系统

## Goal / 目标

All current and future pages must support both `dark` and `light` themes through the shared token system in `app/globals.css`.

当前和未来的所有页面都必须通过 `app/globals.css` 中的共享 token 系统支持 `dark` 与 `light` 两套主题。

This is now a project rule, not a page-specific enhancement.

这已经是项目级规则，而不是某个页面的单独增强项。

## Required Rules / 必须遵守的规则

1. New pages in `app/` must work in both light and dark themes.  
   `app/` 中新增的页面必须同时支持浅色和深色主题。
2. Do not hardcode page-level background or text colors such as `bg-black`, `text-white`, `bg-[#04070b]`, unless they are true brand assets or intentionally isolated exceptions.  
   不要在页面层硬编码背景色或文字色，例如 `bg-black`、`text-white`、`bg-[#04070b]`，除非它们确实属于品牌资产或明确隔离的特殊例外。
3. Prefer semantic tokens such as `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, and `bg-primary`.  
   优先使用语义化 token，例如 `bg-background`、`text-foreground`、`bg-card`、`text-muted-foreground`、`border-border`、`bg-primary`。
4. For full-page layouts, start from the shared shell components in `components/theme-page-shell.tsx`, `components/theme-toggle.tsx`, and `components/language-toggle.tsx`.  
   对于整页布局，优先从 `components/theme-page-shell.tsx`、`components/theme-toggle.tsx`、`components/language-toggle.tsx` 这些共享组件出发。
5. If a page needs a special atmosphere, add CSS variables for both light and dark themes in `app/globals.css` instead of writing one-sided styles.  
   如果页面需要特殊氛围，请在 `app/globals.css` 里同时为浅色和深色补充 CSS 变量，而不是只写单边样式。

## Shared Building Blocks / 共享基础件

### Page Shell / 页面壳层

- `ThemePageShell`
- `ThemeHeroSurface`
- `ThemePanelSurface`

These provide:

这些组件提供：

- shared background atmosphere / 统一的背景氛围
- shared glass-like surfaces / 统一的玻璃感表面
- consistent shadow behavior across both themes / 深浅主题下保持一致的阴影层级

### Controls / 控件

- `ThemeToggle`
- `LanguageToggle`

These should be reused instead of rebuilding page-specific switchers.

这些控件应被复用，而不是在每个页面重新手写一套切换器。

## When Adding A New Page / 新增页面时的建议流程

1. Build the page inside `ThemePageShell`.  
   先在 `ThemePageShell` 内搭建页面。
2. Use `ThemeHeroSurface` for the top summary block.  
   顶部摘要区优先使用 `ThemeHeroSurface`。
3. Use `ThemePanelSurface` for content regions and side panels.  
   内容区与侧栏面板优先使用 `ThemePanelSurface`。
4. Only introduce new theme variables if the page needs a distinct visual mood.  
   只有在页面确实需要独特视觉氛围时，才新增主题变量。
5. Verify both themes before shipping.  
   发布前确认浅色和深色都经过验证。

## Existing Coverage / 当前已覆盖范围

The shared theme system is already applied to:

当前共享主题系统已经覆盖：

- home page / 首页
- login page / 登录页
- game placeholder route / 游戏占位路由页

## Review Checklist / 评审检查清单

Before merging a new page, check:

合并新页面前，请检查：

- Does the page remain readable in light theme? / 浅色主题下页面是否仍然清晰可读？
- Does the page remain readable in dark theme? / 深色主题下页面是否仍然清晰可读？
- Are colors semantic instead of hardcoded? / 颜色是否主要使用语义化 token，而非硬编码？
- Does the page use shared surfaces where appropriate? / 页面是否在合适位置复用了共享表面组件？
- If new visual tokens were introduced, were both themes updated? / 如果新增了视觉 token，是否同时更新了两套主题？
