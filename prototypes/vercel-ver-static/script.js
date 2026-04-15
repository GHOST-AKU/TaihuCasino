const games = [
  {
    title: "Baccarat",
    subtitle: "The classic game of chance",
    icon: "BAC",
    players: 1247,
    rating: 4.9,
    trend: "+12%",
    featured: true
  },
  {
    title: "Blackjack",
    subtitle: "Beat the dealer to 21",
    icon: "BLK",
    players: 892,
    rating: 4.8,
    trend: "+8%"
  },
  {
    title: "Texas Hold'em",
    subtitle: "The world's most popular poker",
    icon: "POK",
    players: 2156,
    rating: 4.9,
    trend: "+15%"
  },
  {
    title: "Dragon Tiger",
    subtitle: "Fast-paced card comparing",
    icon: "DTG",
    players: 634,
    rating: 4.7,
    trend: "+5%"
  },
  {
    title: "Sic Bo",
    subtitle: "Ancient dice game",
    icon: "SBO",
    players: 421,
    rating: 4.6,
    trend: "+3%"
  },
  {
    title: "Roulette",
    subtitle: "Spin the wheel of fortune",
    icon: "RLT",
    players: 756,
    rating: 4.8,
    trend: "+10%"
  }
];

const quickActions = [
  {
    label: "Deposit Funds",
    description: "Add credits to your account",
    icon: "DEP",
    primary: true
  },
  {
    label: "Daily Bonus",
    description: "Claim your daily reward",
    icon: "BON"
  },
  {
    label: "VIP Rewards",
    description: "View exclusive perks",
    icon: "VIP"
  },
  {
    label: "Game History",
    description: "Review your past games",
    icon: "HIS"
  }
];

const livePlayers = [
  { name: "Sarah M.", game: "Baccarat", amount: "+$2,450" },
  { name: "James L.", game: "Blackjack", amount: "+$890" },
  { name: "Emily R.", game: "Texas Hold'em", amount: "+$5,200" },
  { name: "Michael K.", game: "Baccarat", amount: "+$1,100" },
  { name: "Lisa W.", game: "Blackjack", amount: "+$3,750" }
];

const recentActivity = [
  { game: "Baccarat", result: "Won", amount: "+$450", time: "2 hours ago" },
  { game: "Blackjack", result: "Won", amount: "+$120", time: "3 hours ago" },
  { game: "Texas Hold'em", result: "Lost", amount: "-$80", time: "5 hours ago" },
  { game: "Baccarat", result: "Won", amount: "+$680", time: "Yesterday" }
];

function renderGames() {
  const container = document.querySelector("#games-grid");
  if (!container) return;

  container.innerHTML = games
    .map((game) => {
      const featuredClass = game.featured ? " game-card--featured" : "";
      const badge = game.featured ? '<span class="game-card__badge">Hot</span>' : "";

      return `
        <article class="game-card${featuredClass}">
          <div class="game-card__top">
            <div class="game-card__icon" aria-hidden="true">${game.icon}</div>
            ${badge}
          </div>
          <div class="game-card__copy">
            <h3>${game.title}</h3>
            <p>${game.subtitle}</p>
          </div>
          <div class="game-card__bottom">
            <div class="game-card__meta">
              <span>${game.players.toLocaleString()} playing</span>
              <span>★ ${game.rating.toFixed(1)}</span>
              <span>${game.trend}</span>
            </div>
            <span class="game-card__cta">Enter →</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderQuickActions() {
  const container = document.querySelector("#quick-actions");
  if (!container) return;

  container.innerHTML = quickActions
    .map((action) => {
      const variantClass = action.primary ? " quick-action--primary" : "";
      return `
        <button class="quick-action${variantClass}" type="button">
          <span class="quick-action__icon" aria-hidden="true">${action.icon}</span>
          <span class="quick-action__copy">
            <strong>${action.label}</strong>
            <span>${action.description}</span>
          </span>
        </button>
      `;
    })
    .join("");
}

function initials(name) {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function renderLivePlayers(activeIndex = 0) {
  const container = document.querySelector("#live-list");
  if (!container) return;

  container.innerHTML = livePlayers
    .map((player, index) => {
      const activeClass = index === activeIndex ? " is-active" : "";
      return `
        <article class="live-item${activeClass}">
          <div class="live-item__avatar" aria-hidden="true">${initials(player.name)}</div>
          <div class="live-item__copy">
            <strong>${player.name}</strong>
            <span>${player.game}</span>
          </div>
          <span class="live-item__amount">${player.amount}</span>
        </article>
      `;
    })
    .join("");
}

function renderHistory() {
  const container = document.querySelector("#history-grid");
  if (!container) return;

  container.innerHTML = recentActivity
    .map((item) => {
      const won = item.result === "Won";
      const statusClass = won ? "history-card__status--won" : "history-card__status--lost";
      const amountClass = won ? "history-card__amount--won" : "history-card__amount--lost";

      return `
        <article class="history-card">
          <div class="history-card__top">
            <span class="history-card__game">${item.game}</span>
            <span class="history-card__status ${statusClass}">${item.result}</span>
          </div>
          <strong class="history-card__amount ${amountClass}">${item.amount}</strong>
          <span class="history-card__time">${item.time}</span>
        </article>
      `;
    })
    .join("");
}

function setupMobileMenu() {
  const button = document.querySelector(".menu-toggle");
  const mobileNav = document.querySelector("#mobile-nav");
  if (!button || !mobileNav) return;

  button.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    mobileNav.classList.toggle("is-open");
  });

  mobileNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      button.setAttribute("aria-expanded", "false");
      mobileNav.classList.remove("is-open");
    });
  });
}

function setupLiveRotation() {
  let activeIndex = 0;
  renderLivePlayers(activeIndex);

  window.setInterval(() => {
    activeIndex = (activeIndex + 1) % livePlayers.length;
    renderLivePlayers(activeIndex);
  }, 3000);
}

function init() {
  renderGames();
  renderQuickActions();
  renderHistory();
  setupMobileMenu();
  setupLiveRotation();
}

document.addEventListener("DOMContentLoaded", init);
