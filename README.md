# TaihuCasino

TaihuCasino 目前是一个离线静态赌场原型项目，现已采用清晰目录结构，后续开发统一在真实页面文件上进行。

## 项目入口

- `index.html`：项目首页与统一导航
- `pages/roulette.html`：欧式轮盘
- `pages/baccarat.html`：百家乐主版本
- `pages/baccarat2.html`：百家乐备选版本

## 目录结构

```text
.
├─ index.html
├─ pages/
├─ assets/
│  ├─ css/
│  ├─ js/
│  └─ images/
├─ docs/
└─ README.md
```

更多说明见 `docs/PROJECT_STRUCTURE.md`。

## 维护约定

- 以后只修改 `pages/` 下的真实页面。
- 不再保留根目录旧版 html 入口。
- 公共资源统一放在 `assets/`。

## License

- `LICENSE`
- `Surreal Chaos License v0.1.md`
