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
      hint: "使用 Google 账号登录。"
    },
    apple: {
      label: "Apple",
      connection: "apple",
      enabled: false,
      pendingMessage: "即将开放"
    },
    microsoft: {
      label: "Microsoft",
      connection: "windowslive",
      enabled: true,
      hint: "使用 Microsoft 账号登录。"
    },
    amazon: {
      label: "Amazon",
      connection: "amazon",
      enabled: false,
      pendingMessage: "即将开放"
    },
    github: {
      label: "GitHub",
      connection: "github",
      enabled: false,
      pendingMessage: "即将开放"
    },
    facebook: {
      label: "Facebook",
      connection: "facebook",
      enabled: false,
      pendingMessage: "即将开放"
    },
    x: {
      label: "X",
      connection: "twitter",
      enabled: false,
      pendingMessage: "即将开放"
    },
    line: {
      label: "LINE",
      connection: "line",
      enabled: false,
      pendingMessage: "即将开放"
    },
    discord: {
      label: "Discord",
      connection: "discord",
      enabled: false,
      pendingMessage: "即将开放"
    },
    linkedin: {
      label: "LinkedIn",
      connection: "linkedin",
      enabled: false,
      pendingMessage: "即将开放"
    },
    twitch: {
      label: "Twitch",
      connection: "twitch",
      enabled: false,
      pendingMessage: "即将开放"
    },
    yahoo: {
      label: "Yahoo",
      connection: "yahoo",
      enabled: false,
      pendingMessage: "即将开放"
    },
    wechat: {
      label: "WeChat",
      connection: "wechat",
      enabled: false,
      pendingMessage: "即将开放"
    }
  }
};
