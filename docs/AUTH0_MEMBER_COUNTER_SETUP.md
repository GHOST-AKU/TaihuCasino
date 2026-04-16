# Auth0 Member Counter Setup / Auth0 会员柜台接入说明

## Scope / 适用范围

This document applies to `pages/member-counter.html`, which uses the Auth0 SPA SDK.

本文档对应 `pages/member-counter.html`，认证方式为 Auth0 SPA SDK。

## File To Configure / 需要配置的文件

Edit `assets/js/member-auth-config.js`:

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

## Recommended First Setup Order / 首轮推荐接入顺序

1. Create a Single Page Application in Auth0.  
   在 Auth0 中创建 Single Page Application。
2. Add `pages/member-counter.html` to Allowed Callback URLs.  
   把 `pages/member-counter.html` 加入 Allowed Callback URLs。
3. Add the same URL to Allowed Logout URLs.  
   把同一地址加入 Allowed Logout URLs。
4. Enable Google and Microsoft first, and confirm that real login and callback flows work.  
   优先启用 Google 和 Microsoft，确认真实登录与回调流程可用。
5. After the formal domain is ready, enable Apple, Amazon, and other smaller providers one by one.  
   等正式域名准备好后，再逐个启用 Apple、Amazon 和其他小型 provider。

## Notes / 说明

- This page uses `cacheLocation: "localstorage"` so sessions can survive refreshes on a static site.  
  本页使用 `cacheLocation: "localstorage"`，方便静态站刷新后恢复会话。
- `window.login(provider)` and `window.logout()` are exposed by the page script.  
  `window.login(provider)` 与 `window.logout()` 已由页面脚本暴露。
- Whether Apple, Amazon, WeChat, and similar providers can go live immediately depends on provider backend setup, domain readiness, and platform review, not only on page code.  
  Apple、Amazon、WeChat 等 provider 能否立刻上线，不只取决于页面代码，还取决于提供商后台、域名和平台审核状态。
