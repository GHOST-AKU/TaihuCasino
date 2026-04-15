# TaihuCasino Theme System

## Goal

All current and future pages must support both `dark` and `light` themes through the shared token system in `app/globals.css`.

This is now a project rule, not a page-specific enhancement.

## Required Rules

1. New pages in `app/` must work in both light and dark themes.
2. Do not hardcode page-level background/text colors such as `bg-black`, `text-white`, `bg-[#04070b]`, or large blocks of one-off color values unless they are truly brand assets.
3. Prefer semantic tokens:
   - `bg-background`
   - `text-foreground`
   - `bg-card`
   - `text-muted-foreground`
   - `border-border`
   - `bg-primary`
4. For full-page layouts, start from the shared shell components:
   - `components/theme-page-shell.tsx`
   - `components/theme-toggle.tsx`
   - `components/language-toggle.tsx`
5. If a page needs special atmosphere, add new CSS variables in `app/globals.css` for both light and dark themes instead of writing one-sided styles.

## Shared Building Blocks

### Page shell

- `ThemePageShell`
- `ThemeHeroSurface`
- `ThemePanelSurface`

These provide:

- shared background atmosphere
- shared glass-like surfaces
- consistent shadow behavior across both themes

### Controls

- `ThemeToggle`
- `LanguageToggle`

These should be reused instead of rebuilding page-specific switchers.

## When adding a new page

Recommended flow:

1. Build the page inside `ThemePageShell`.
2. Use `ThemeHeroSurface` for the top summary block.
3. Use `ThemePanelSurface` for content regions and side panels.
4. Only introduce new theme variables if the page needs a distinct visual mood.
5. Verify both themes before shipping.

## Existing coverage

The shared theme system is already applied to:

- home page
- login page
- game placeholder route

## Review checklist

Before merging a new page, check:

- Does the page remain readable in light theme?
- Does the page remain readable in dark theme?
- Are colors semantic instead of hardcoded?
- Does the page use shared surfaces where appropriate?
- If new visual tokens were introduced, were both themes updated?
