# TaihuCasino Light Theme Plan v1 / TaihuCasino 浅色界面方案 v1

## Goal / 目标

Upgrade the lobby experience from a dark-only interface to a controlled light/dark dual-theme system.

将大厅体验从“仅深色界面”升级为受控的深浅双主题系统。

The light theme should not be a simple inversion of the dark theme. It should preserve the refined, orderly, and lightly luxurious atmosphere expected from TaihuCasino.

浅色主题不应只是深色主题的简单反相，而应保留 TaihuCasino 应有的精致感、秩序感和轻奢气质。

## Visual Direction / 视觉方向

- Keywords: morning mist, champagne gold, jade green, glass surface.  
  关键词：晨雾、香槟金、玉石绿、玻璃感。
- Tone: bright but not glaring, light but not weak, premium but restrained.  
  气质：亮而不刺眼，轻而不发飘，高级但克制。
- Scenarios: daytime browsing, front-desk presentation, mobile long-session use, and new-player onboarding.  
  适用场景：白天访问、前台接待、移动端长时间浏览、新玩家引导。

## Color Strategy / 配色策略

### Base Colors / 基础色

- Page background: warm off-white, not pure white.  
  页面背景：暖白偏米色，不使用纯白。
- Card background: bright translucent white.  
  卡片背景：更高亮的半透明白色。
- Dividers: low-contrast warm gray.  
  分割线：低对比暖灰。
- Main text: deep blue-black gray instead of pure black.  
  主文字：偏蓝黑的深灰，避免纯黑。

### Brand Accents / 品牌强调色

- Primary accent: jade green.  
  主强调色：翡翠绿。
- Secondary accent: champagne gold glow.  
  次强调色：香槟金雾光。
- Destructive color: keep red, but avoid neon intensity.  
  危险色：保留红色，但降低荧光感。

### Light And Shadow / 光影策略

- Dark theme uses deeper shadow and ambient glow.  
  深色主题使用更深的阴影和氛围泛光。
- Light theme uses soft floating shadow and subtle surface separation.  
  浅色主题使用柔和悬浮阴影和轻微表面分层。
- Key blocks should keep a glass-like material to preserve the “premium lobby” feeling.  
  重点区块应保留轻微玻璃材质，强化“高级大厅”气质。

## Component Rules / 组件规则

### Header / 头部

- Replace the guest/member perspective switch with the light/dark theme switch.  
  用深浅主题切换替代原“游客/玩家视角切换”。
- Keep the language switch.  
  保留语言切换。
- Use a segmented two-button theme control on desktop, and place it inside the mobile menu on mobile.  
  桌面端使用双按钮分段式主题控件，移动端放入折叠菜单。

### Hero Area / Hero 区

- Use a light glass surface instead of a flat solid block.  
  使用浅色玻璃表面，而不是平铺纯色块。
- Preserve existing content hierarchy while increasing whitespace clarity.  
  沿用现有内容层级，同时加强留白清晰度。
- Use one unified panel material for highlight blocks.  
  高亮信息块统一使用同一种面板材质。

### Information Panels / 信息面板

- Recommended actions, history cards, and highlight cards should share the same surface language.  
  推荐动作、历史记录和亮点卡片应使用一致的表面语言。
- In light theme, hover feedback should rely mostly on border and foreground changes, not heavy shadow.  
  浅色主题下，hover 反馈应以边框和前景色变化为主，不依赖重阴影。

## Motion And Atmosphere / 动效与氛围

- Keep two soft ambient background orbs.  
  保留两组柔和背景氛围光斑。
- Add low-density grid texture to give blank areas structure.  
  增加低密度网格纹理，让留白区域更有秩序。
- Do not add dramatic animation; preserve the existing page rhythm.  
  不新增夸张动画，保持现有页面节奏。

## Implemented Scope / 已落地内容

- Root layout is connected to `next-themes`.  
  根布局已接入 `next-themes`。
- Header includes light/dark theme switching.  
  头部已加入深浅主题切换。
- Light theme tokens are added to `app/globals.css`.  
  浅色主题 token 已加入 `app/globals.css`。
- Home page, login page, and game placeholder route use the shared theme system.  
  首页、登录页和游戏占位路由已使用共享主题系统。
- Guest/member perspective is now inferred from login state instead of manually switched.  
  游客/会员视角改为根据登录态自动判断，不再手动切换。

## Next Steps / 后续建议

- Continue applying the same theme tokens to future formal routes.  
  后续正式路由继续使用同一套主题 token。
- Convert legacy pages into React routes instead of adding more one-off CSS.  
  将遗留页面逐步迁移为 React 路由，而不是继续追加一次性 CSS。
- For any new chart or data component, prefer semantic tokens over hardcoded colors.  
  新增图表或数据组件时，优先使用语义化 token，不直接写死颜色。
