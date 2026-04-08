window.TAIHU_AUTH_CONFIG = window.TAIHU_AUTH_CONFIG || {
  domain: "",
  clientId: "",
  audience: "",
  redirectUri: "",
  logoutReturnTo: "",
  providers: {
    google: {
      label: "Google",
      connection: "google-oauth2",
      enabled: true,
      hint: "适合先行打通真实登录回调。"
    },
    apple: {
      label: "Apple",
      connection: "apple",
      enabled: false,
      pendingMessage: "待开通或待域名验证"
    },
    microsoft: {
      label: "Microsoft",
      connection: "windowslive",
      enabled: true,
      hint: "支持使用 Microsoft 账号进入会员柜台。"
    },
    amazon: {
      label: "Amazon",
      connection: "amazon",
      enabled: false,
      pendingMessage: "待开通或待商户审核"
    },
    github: {
      label: "GitHub",
      connection: "github",
      enabled: false,
      pendingMessage: "待在 Auth0 Social Connections 中启用"
    },
    facebook: {
      label: "Facebook",
      connection: "facebook",
      enabled: false,
      pendingMessage: "待在 Meta 开发者后台完成配置"
    },
    x: {
      label: "X",
      connection: "twitter",
      enabled: false,
      pendingMessage: "待接通 X / Twitter 社交连接"
    },
    line: {
      label: "LINE",
      connection: "line",
      enabled: false,
      pendingMessage: "待开通 LINE Login"
    },
    discord: {
      label: "Discord",
      connection: "discord",
      enabled: false,
      pendingMessage: "待开通 Discord Social Connection"
    },
    linkedin: {
      label: "LinkedIn",
      connection: "linkedin",
      enabled: false,
      pendingMessage: "待接通 LinkedIn 开发者应用"
    },
    twitch: {
      label: "Twitch",
      connection: "twitch",
      enabled: false,
      pendingMessage: "待接通 Twitch 开发者应用"
    },
    yahoo: {
      label: "Yahoo",
      connection: "yahoo",
      enabled: false,
      pendingMessage: "待在 Auth0 中补充 Yahoo 连接"
    },
    wechat: {
      label: "WeChat",
      connection: "wechat",
      enabled: false,
      pendingMessage: "待接入微信开放平台能力"
    }
  }
};
