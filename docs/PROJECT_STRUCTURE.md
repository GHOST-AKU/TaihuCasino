# TaihuCasino 项目结构

当前仓库已经整理为适合继续扩展的静态项目骨架：

```text
TaihuCasino/
├─ index.html              # 统一入口页
├─ pages/                  # 实际游戏页面
│  ├─ roulette.html
│  ├─ baccarat.html
│  └─ baccarat2.html
├─ assets/
│  ├─ css/                 # 公共样式
│  ├─ js/                  # 公共脚本
│  └─ images/              # 图片与 logo
├─ docs/                   # 项目文档
└─ README.md
```

## 当前约定

- 真正的页面内容放在 `pages/` 下，后续开发只修改这里。
- `index.html` 负责统一入口和导航。
- 公共导航、项目首页、后续统一主题样式放在 `assets/`。

## 建议下一步

1. 选定一个百家乐页面作为唯一主版本，另一个转为归档或实验页。
2. 把公共颜色、按钮、面板样式从各页面内联 CSS 中提取到 `assets/css/`。
3. 逐步把内联脚本拆分为独立 JS 文件，方便维护和复用。
