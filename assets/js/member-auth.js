(function () {
  const config = window.TAIHU_AUTH_CONFIG || {};
  const providerConfig = config.providers || {};
  const sdkVersion = "2.17";
  let auth0Client = null;
  let currentUser = null;

  const state = {
    isConfigured: Boolean(config.domain && config.clientId),
    isAuthenticated: false,
    authError: ""
  };

  const elements = {
    statusBanner: document.querySelector("[data-auth-banner]"),
    statusTitle: document.querySelector("[data-auth-banner-title]"),
    statusMessage: document.querySelector("[data-auth-banner-message]"),
    providerCards: Array.from(document.querySelectorAll("[data-provider-card]")),
    providerButtons: Array.from(document.querySelectorAll("[data-provider-login]")),
    sessionMode: document.querySelector("[data-session-mode]"),
    sessionState: document.querySelector("[data-session-state]"),
    sessionHint: document.querySelector("[data-session-hint]"),
    profileName: document.querySelector("[data-profile-name]"),
    profileEmail: document.querySelector("[data-profile-email]"),
    profileProvider: document.querySelector("[data-profile-provider]"),
    profileConnection: document.querySelector("[data-profile-connection]"),
    profileAvatar: document.querySelector("[data-profile-avatar]"),
    enterLobby: document.querySelector("[data-enter-lobby]"),
    logoutButton: document.querySelector("[data-logout]"),
    configField: document.querySelector("[data-config-field]")
  };

  const providerMeta = {
    google: { displayName: "Google", badge: "即刻可接通" },
    apple: { displayName: "Apple", badge: "需正式域名" },
    microsoft: { displayName: "Microsoft", badge: "企业与个人账号" },
    amazon: { displayName: "Amazon", badge: "待补生产配置" },
    github: { displayName: "GitHub", badge: "开发者常用" },
    facebook: { displayName: "Facebook", badge: "国际社交入口" },
    x: { displayName: "X", badge: "待接通 X / Twitter" },
    line: { displayName: "LINE", badge: "亚洲社交入口" },
    discord: { displayName: "Discord", badge: "社区账号入口" },
    linkedin: { displayName: "LinkedIn", badge: "职业身份入口" },
    twitch: { displayName: "Twitch", badge: "直播社区入口" },
    yahoo: { displayName: "Yahoo", badge: "经典邮箱入口" },
    wechat: { displayName: "WeChat", badge: "待补中国区方案" }
  };

  function normalizeConfig() {
    const fallbackRedirect = window.location.href.split("?")[0];
    return {
      domain: config.domain || "",
      clientId: config.clientId || "",
      audience: config.audience || "",
      redirectUri: config.redirectUri || fallbackRedirect,
      logoutReturnTo: config.logoutReturnTo || fallbackRedirect
    };
  }

  function setBanner(tone, title, message) {
    if (!elements.statusBanner) return;
    elements.statusBanner.dataset.tone = tone;
    elements.statusTitle.textContent = title;
    elements.statusMessage.textContent = message;
  }

  function setSessionNotice(title, hint) {
    if (elements.sessionState) elements.sessionState.textContent = title;
    if (elements.sessionHint) elements.sessionHint.textContent = hint;
  }

  function getProvider(providerId) {
    return providerConfig[providerId] || null;
  }

  function getProviderStatus(providerId) {
    const provider = getProvider(providerId);
    if (!state.isConfigured) return "disabled";
    if (!provider) return "disabled";
    if (provider.enabled === false) return "pending";
    if (!provider.connection) return "pending";
    return "ready";
  }

  function getProviderMessage(providerId) {
    const provider = getProvider(providerId);
    if (!state.isConfigured) return "尚未填写 Auth0 domain 与 clientId，当前只展示真实接入结构。";
    if (!provider) return "该登录方式尚未配置。";
    if (provider.enabled === false) return provider.pendingMessage || "待开通";
    if (!provider.connection) return "缺少 Auth0 connection 名称。";
    return provider.hint || "可跳转到 Auth0 Universal Login。";
  }

  function updateProviderCards() {
    elements.providerCards.forEach((card) => {
      const providerId = card.dataset.providerCard;
      const status = getProviderStatus(providerId);
      const button = card.querySelector("[data-provider-login]");
      const meta = card.querySelector("[data-provider-meta]");
      const displayName = providerMeta[providerId] ? providerMeta[providerId].displayName : providerId;

      card.dataset.status = status;

      if (meta) {
        meta.textContent = status === "ready"
          ? (providerMeta[providerId] && providerMeta[providerId].badge ? providerMeta[providerId].badge : "已接入")
          : getProviderMessage(providerId);
      }

      if (!button) return;

      if (status === "ready") {
        button.disabled = false;
        button.textContent = `使用 ${displayName}`;
      } else if (status === "pending") {
        button.disabled = true;
        button.textContent = "待开通";
      } else {
        button.disabled = true;
        button.textContent = "待配置";
      }
    });
  }

  function setAvatar(user) {
    if (!elements.profileAvatar) return;
    elements.profileAvatar.textContent = "";

    if (user && user.picture) {
      const avatar = document.createElement("img");
      avatar.setAttribute("src", String(user.picture));
      avatar.setAttribute("alt", `${String(user.name || "member")} avatar`);
      elements.profileAvatar.appendChild(avatar);
      return;
    }

    const seed = user && (user.name || user.nickname || user.email) ? (user.name || user.nickname || user.email) : "Guest";
    elements.profileAvatar.textContent = String(seed).trim().charAt(0).toUpperCase() || "G";
  }

  function getProviderLabelFromUser(user) {
    const subtype = user && user.sub ? user.sub.split("|")[0] : "";
    if (!subtype) return state.isConfigured ? "等待登录" : "等待配置";

    const matchedKey = Object.keys(providerConfig).find((key) => {
      const provider = providerConfig[key];
      return provider && provider.connection === subtype;
    });

    if (matchedKey && providerMeta[matchedKey]) return providerMeta[matchedKey].displayName;
    return subtype;
  }

  function updateSession(user) {
    const isAuthed = Boolean(user);
    state.isAuthenticated = isAuthed;

    if (elements.sessionMode) elements.sessionMode.dataset.mode = isAuthed ? "authenticated" : "guest";
    if (elements.enterLobby) elements.enterLobby.removeAttribute("aria-disabled");
    if (elements.enterLobby) elements.enterLobby.style.pointerEvents = isAuthed ? "auto" : "none";
    if (elements.enterLobby) elements.enterLobby.style.opacity = isAuthed ? "1" : "0.56";
    if (elements.logoutButton) elements.logoutButton.disabled = !isAuthed;

    if (isAuthed) {
      elements.profileName.textContent = user.name || user.nickname || "Taihu Member";
      elements.profileEmail.textContent = user.email || "该账号暂未返回邮箱";
      elements.profileProvider.textContent = getProviderLabelFromUser(user);
      elements.profileConnection.textContent = user.sub || "未返回 sub";
      setAvatar(user);
      setSessionNotice("会员席位已激活", "当前会话来自 Auth0 SPA SDK，本地刷新后会继续尝试恢复登录态。");
      return;
    }

    elements.profileName.textContent = "未登录访客";
    elements.profileEmail.textContent = "完成快捷登录后，这里会显示会员邮箱与席位信息。";
    elements.profileProvider.textContent = state.isConfigured ? "等待登录" : "等待配置";
    elements.profileConnection.textContent = state.isConfigured ? "Universal Login 尚未启动" : "请先填写 assets/js/member-auth-config.js";
    setAvatar(null);

    if (state.authError) {
      setSessionNotice("登录流程需要关注", state.authError);
    } else if (!state.isConfigured) {
      setSessionNotice("Auth0 尚未配置", "请填写 domain、clientId，以及需要启用的 provider connection 名称。");
    } else {
      setSessionNotice("柜台待接待", "点击任一可用入口即可跳转到 Auth0 Universal Login。");
    }
  }

  async function createClient() {
    if (!window.auth0 || typeof window.auth0.createAuth0Client !== "function") {
      throw new Error(`Auth0 SPA SDK 未加载，请确认 https://cdn.auth0.com/js/auth0-spa-js/${sdkVersion}/auth0-spa-js.production.js 可访问。`);
    }

    const resolved = normalizeConfig();
    const options = {
      domain: resolved.domain,
      clientId: resolved.clientId,
      cacheLocation: "localstorage",
      authorizationParams: {
        redirect_uri: resolved.redirectUri
      }
    };

    if (resolved.audience) {
      options.authorizationParams.audience = resolved.audience;
    }

    auth0Client = await window.auth0.createAuth0Client(options);
    return auth0Client;
  }

  async function restoreSession() {
    if (!auth0Client) return null;

    if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
      try {
        await auth0Client.handleRedirectCallback();
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        state.authError = error && error.message ? error.message : "回调处理失败。";
      }
    }

    try {
      const isAuthenticated = await auth0Client.isAuthenticated();
      currentUser = isAuthenticated ? await auth0Client.getUser() : null;
      return currentUser;
    } catch (error) {
      state.authError = error && error.message ? error.message : "会话恢复失败。";
      currentUser = null;
      return null;
    }
  }

  async function login(providerId) {
    const status = getProviderStatus(providerId);
    const provider = getProvider(providerId);
    const displayName = providerMeta[providerId] ? providerMeta[providerId].displayName : providerId;

    if (status !== "ready") {
      setBanner(status === "pending" ? "warn" : "danger", `${displayName} 暂不可用`, getProviderMessage(providerId));
      return;
    }

    if (!auth0Client) {
      setBanner("danger", "Auth0 客户端尚未就绪", "请先填写配置并刷新页面，再重试快捷登录。");
      return;
    }

    const resolved = normalizeConfig();
    await auth0Client.loginWithRedirect({
      authorizationParams: {
        redirect_uri: resolved.redirectUri,
        connection: provider.connection
      }
    });
  }

  async function logout() {
    if (!auth0Client) return;
    const resolved = normalizeConfig();

    await auth0Client.logout({
      logoutParams: {
        returnTo: resolved.logoutReturnTo
      }
    });
  }

  function bindEvents() {
    elements.providerButtons.forEach((button) => {
      button.addEventListener("click", async function () {
        const providerId = button.dataset.providerLogin;
        try {
          await login(providerId);
        } catch (error) {
          state.authError = error && error.message ? error.message : "登录跳转失败。";
          setBanner("danger", "登录未能完成", state.authError);
          updateSession(null);
        }
      });
    });

    if (elements.logoutButton) {
      elements.logoutButton.addEventListener("click", async function () {
        try {
          await logout();
        } catch (error) {
          state.authError = error && error.message ? error.message : "登出失败。";
          setBanner("danger", "登出未能完成", state.authError);
        }
      });
    }
  }

  async function init() {
    if (elements.configField) elements.configField.textContent = "assets/js/member-auth-config.js";

    updateProviderCards();
    bindEvents();
    updateSession(null);

    if (!state.isConfigured) {
      setBanner("warn", "柜台已搭建，Auth0 仍待配置", "页面已接入真实 Auth0 SPA 结构。填写 domain、clientId 与 provider connection 后，已启用方式会转为真实跳转。");
      return;
    }

    try {
      await createClient();
      const user = await restoreSession();

      if (user) {
        setBanner("success", "会员身份已恢复", "本页已通过 Auth0 SPA SDK 恢复会话，你可以继续进入大厅或切换账号。");
        updateSession(user);
      } else if (state.authError) {
        setBanner("danger", "Auth0 已连接，但回调需要处理", state.authError);
        updateSession(null);
      } else {
        setBanner("success", "柜台已连接 Auth0", "已启用并配置 connection 的 provider 现在可以发起真实登录跳转，未开通方式会保持待接入状态。");
        updateSession(null);
      }
    } catch (error) {
      state.authError = error && error.message ? error.message : "Auth0 初始化失败。";
      setBanner("danger", "Auth0 初始化失败", state.authError);
      updateSession(null);
      updateProviderCards();
    }
  }

  window.TaihuMemberAuth = {
    init: init,
    login: login,
    logout: logout,
    getUser: function () {
      return currentUser;
    }
  };

  window.login = login;
  window.logout = logout;
  document.addEventListener("DOMContentLoaded", init);
})();
