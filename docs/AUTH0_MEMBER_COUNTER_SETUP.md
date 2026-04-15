# TaihuCasino 会员注册柜台 Auth0 接入说明

本页对应 `pages/member-counter.html`，认证方式为 Auth0 SPA SDK。

## 需要填写的文件

编辑 `assets/js/member-auth-config.js`：

```js
window.TAIHU_AUTH_CONFIG = {
  domain: "your-tenant.us.auth0.com",
  clientId: "yourClientId",
  audience: "",
  redirectUri: "https://your-domain/pages/member-counter.html",
  logoutReturnTo: "https://your-domain/pages/member-counter.html",
  providers: {
    google: { connection: "google-oauth2", enabled: true },
    apple: { connection: "apple", enabled: false },
    microsoft: { connection: "windowslive", enabled: true },
    amazon: { connection: "amazon", enabled: false },
    github: { connection: "github", enabled: false },
    facebook: { connection: "facebook", enabled: false },
    x: { connection: "twitter", enabled: false },
    line: { connection: "line", enabled: false },
    discord: { connection: "discord", enabled: false },
    linkedin: { connection: "linkedin", enabled: false },
    twitch: { connection: "twitch", enabled: false },
    yahoo: { connection: "yahoo", enabled: false },
    wechat: { connection: "wechat", enabled: false }
  }
};
```

## 首轮推荐顺序

1. 在 Auth0 创建 Single Page Application。
2. 把 `pages/member-counter.html` 加到 Allowed Callback URLs。
3. 把同一个地址加到 Allowed Logout URLs。
4. 先启用 Google 和 Microsoft 连接，确认真实登录与回调可用。
5. 正式域名准备好后，再分别开启 Apple、Amazon 与其他小众 provider。

## 说明

- 本页使用 `cacheLocation: "localstorage"`，方便静态站刷新后恢复会话。
- `window.login(provider)` 与 `window.logout()` 已由页面脚本暴露。
- Apple、Amazon、WeChat 等是否能立刻上线，不取决于页面代码，而取决于提供商后台、域名和平台审核是否完成。
