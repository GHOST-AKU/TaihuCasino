# Legacy-to-App Migration Matrix / 遗留层迁移优先级矩阵

Status: planning only; no files were migrated or retired by this document.

状态：仅规划；本文档没有迁移或下线任何文件。

Inventory snapshot: 2026-08-13, baseline commit `ff89d5826fc4fd5f7b1efa8e7a9eec5b6d407070`.

## Decision Rules / 分批规则

- **M1 — boundary and security first / 边界与安全优先**: remove alternate auth or settlement paths, broken wrappers, and externally loaded runtime dependencies after the formal route proves parity.
- **M2 — core game parity / 核心游戏等价迁移**: retire duplicated single-player game implementations only after the App Router route is server-authoritative and has a documented rollback path.
- **M3 — archive and product-decision gated / 归档与产品决策门槛**: utility, hospitality, prototype, and brand assets wait for the product decision in Issue #61; do not broadly rename or delete them.

`M1/M2/M3` is a sequencing decision, not permission to delete. Every retirement needs its own issue/PR, usage evidence, and rollback plan.

## `pages/` Inventory / 页面逐文件矩阵

All nine files under `pages/` are assigned below.

| Legacy file | Batch | Current consumer and formal destination | Dependency and migration risk | Definition of done for the file |
| --- | --- | --- | --- | --- |
| `pages/member-counter.html` | M1 | `/legacy/member-counter`; formal destination `/member` and `/member/settings` | Loads root legacy CSS/JS plus Auth0 CDN; uses relative links that do not match App Router routes; represents an obsolete identity stack beside Supabase | Supabase member routes cover sign-in state and settings; public legal/support links satisfy #55; no production link targets this page; archive evidence is recorded before removing its catalog fallback |
| `pages/roulette_openui.html` | M1 | `/legacy/roulette-studio`; formal destination `/games/roulette-studio` | Tabler CDN dependency, nested `roulette.html` iframe, and broken `../home*.html` links; creates a second presentation shell around a legacy game | Formal studio route has equivalent table intent without iframe/CDN; direct legacy traffic is checked; catalog fallback can be removed independently and restored by one revert |
| `pages/blackjack.html` | M1 | `/legacy/blackjack`; formal destination `/games/blackjack` | Inline client deck/settlement conflicts with the authoritative blackjack state machine and its hidden-state boundary | Formal route exclusively uses versioned server actions; active/settled/voided recovery and cash-out blocking remain covered; no link or catalog entry needs the legacy file; rollback does not require a database down migration |
| `pages/baccarat.html` | M2 | `/legacy/baccarat`; formal destination `/games/baccarat` | Large inline CSS/JS implementation duplicates result, balance, and history behavior | App route uses canonical `RoundEnvelope`, server result, and server history; visual/rule parity is accepted; fallback removal is isolated to this slug |
| `pages/baccarat2.html` | M2 | `/legacy/baccarat-vip`; formal destination `/games/baccarat-vip` | VIP variant duplicates baccarat logic and can drift from the main ruleset | Variant is expressed by catalog/configuration over the shared authoritative baccarat engine; no independent settlement code remains; fallback can be restored without changing schema |
| `pages/dice.html` | M2 | `/legacy/dice`; formal destination `/games/dice` | Inline random/result state plus relative cocktail-service navigation; alternate client-settlement surface | Formal route is server-authoritative, navigation uses App Router URLs, and the selected replacement preserves documented rules; direct fallback traffic is zero or explicitly accepted |
| `pages/roulette.html` | M2 | `/legacy/roulette`; formal destination `/games/roulette` | Large inline wheel/result implementation; also embedded by `roulette_openui.html` | Main and studio routes share canonical rules/result contracts; iframe consumer is retired first; no remaining runtime reference requires this file |
| `pages/cocktail-bar.html` | M3 | `/legacy/cocktail-bar`; current formal destination `/games/cocktail-bar` | Local-storage inventory/statistics and hospitality positioning may be archived or adapted under #61 | #61 classifies the capability as `preserve`, `adapt`, `archive`, or `remove`; state ownership is explicit; selected action has a reversible, file-scoped PR |
| `pages/casino-cocktail-service.html` | M3 | `/legacy/cocktail-service`; current formal destination `/games/cocktail-service` | Local-storage service state and links back to four legacy tables; tied to the previous hospitality/companionship direction | #61 classification is approved; all retained navigation uses formal routes; any retained state has a stable versioned contract; archive/removal preserves a historical copy |

## `assets/` Inventory / 资源逐文件矩阵

All thirteen files under `assets/` are assigned below. References from `prototypes/legacy-static/*.html` currently point at a non-existent nested `prototypes/legacy-static/assets/` path; those references are archival evidence, not proof that root `assets/` is a supported production dependency.

| Legacy file | Batch | Known consumers | Dependency and migration risk | Definition of done for the file |
| --- | --- | --- | --- | --- |
| `assets/css/member-counter.css` | M1 | `pages/member-counter.html`, catalog metadata | Coupled to obsolete Auth0 DOM and cannot be safely reused as formal theme CSS | Member page parity accepted; no catalog/runtime reference remains; archive or removal is in the same scoped PR as the legacy member counter |
| `assets/js/member-auth-config.js` | M1 | `pages/member-counter.html`, `docs/AUTH0_MEMBER_COUNTER_SETUP.md`, catalog metadata | Browser-global Auth0 config represents a competing auth source of truth | Supabase is the sole formal auth path; historical setup doc is marked/archived in its own issue; no runtime reads `TAIHU_AUTH_CONFIG` |
| `assets/js/member-auth.js` | M1 | `pages/member-counter.html`, catalog metadata | Loads Auth0 SPA state into `localStorage`; security and account-rights behavior diverges from formal server-cookie auth | No production route loads it; Supabase session and #55 account-rights paths are accepted; removal does not alter formal auth code |
| `assets/images/taihu-casino-logo-v3.svg` | M1 | `pages/member-counter.html`; archival `home.html`/`home2.html` references | Shared by the obsolete runtime page and historical brand prototypes | Runtime dependency is removed with member counter; any historical copy stays with the archive; #61 decides future display branding rather than a bulk rename |
| `assets/css/home.css` | M3 | Archival `prototypes/legacy-static/home.html` reference only | Prototype-relative path is broken; visual vocabulary is Taihu-brand specific | #61 classifies it; if archived, asset and HTML live together with a working relative path; it is never copied into formal global CSS wholesale |
| `assets/css/home2.css` | M3 | Archival `home2.html` reference only | Same broken archive-relative path and brand coupling | Same archive/classification gate; reusable tokens, if any, are extracted intentionally and independently |
| `assets/css/home3.css` | M3 | Archival `home3.html` reference only | Same broken archive-relative path and brand coupling | Same archive/classification gate; no formal runtime import remains |
| `assets/css/home_material.css` | M3 | Archival `home_Material.html` reference only | Material exploration is not a formal design-system source | #61/design issue explicitly chooses archive or adaptation; no implicit promotion into the formal UI |
| `assets/css/site.css` | M3 | Archival `prototypes/legacy-static/index.html` reference only | Prototype shell styles and a broken relative reference | Asset is colocated with archive or removed after evidence; formal styles remain in `app/globals.css`/components |
| `assets/js/site.js` | M3 | Archival `prototypes/legacy-static/index.html` reference only | Tiny DOM-ready marker but still an unowned legacy global | Prototype is self-contained or archived; no formal page depends on the global side effect |
| `assets/images/taihu-casino-logo.svg` | M3 | Archival `prototypes/legacy-static/index.html` reference only | Taihu wordmark is directly affected by pending #61 direction | Preserve until #61 classification; never mass-replace paths or filenames before the migration inventory is approved |
| `assets/images/taihu-casino-logo-v2.svg` | M3 | No repository reference found at snapshot | Orphan candidate, but branded and historically useful | #61 classifies it and an archive/removal PR records `rg` evidence; absence of references is rechecked immediately before action |
| `assets/images/heart.svg` | M3 | No repository reference found at snapshot | Orphan candidate associated with the former companionship vocabulary | #61 classifies it; removal/archive remains reversible and separate from gameplay changes |

## Batch Completion Standards / 每批完成标准

### M1

- [ ] Formal Supabase auth/session behavior is the only production identity path.
- [ ] Issue #54 production gates are recorded truthfully: `TAIHU_RATE_LIMIT_SECRET`, Supabase Auth rate limits/CAPTCHA, and cleanup/security-event monitoring are human-operated and remain `NO-GO` until evidenced.
- [ ] Issue #55 production gates are recorded truthfully: legal text, launch regions, age threshold, support contact, retention rules, and account-deletion review remain `NO-GO` until approved.
- [ ] Blackjack clients cannot access hidden state or perform final settlement.
- [ ] Each retired slug has direct-traffic evidence, a one-revert application rollback, and no database down migration.

### M2

- [ ] Baccarat, baccarat VIP, dice, roulette, and roulette studio consume server-authoritative round contracts.
- [ ] Rule, payout, history, recovery, and accessibility parity is signed off per slug.
- [ ] Catalog metadata points at formal routes; legacy traffic is zero or an explicitly approved exception.
- [ ] Every file is retired in a bounded issue/PR; there is no directory-wide move.

### M3

- [ ] Issue #61 has an explicit product decision and migration inventory classification.
- [ ] Brand/display copy is separated from stable game IDs, rule contracts, routes, and persistence keys so a future Taihu-to-OGO adaptation does not require settlement/schema rewrites.
- [ ] Hospitality/prototype content is individually classified as `preserve`, `adapt`, `archive`, or `remove`.
- [ ] Historical assets remain readable from their archive location, or removal evidence proves they are unreferenced.

## Dependency Order / 依赖顺序

1. Accept formal auth, legal/account-rights, abuse-protection, and release gates.
2. Retire `member-counter` and `roulette_openui` wrappers.
3. Retire blackjack only after its authoritative state-machine contract remains green.
4. Retire M2 game files one slug at a time; `roulette_openui.html` must stop embedding `roulette.html` first.
5. Make the #61 decision before touching M3 hospitality or brand assets.

## Follow-up Issue Template / 后续 Issue 模板

Each implementation issue should name exactly one legacy file (or one inseparable page-and-assets group), its formal route, parity checklist, current references, telemetry window, rollback commit, and whether any schema compatibility window is required. It must explicitly state that broad renaming, directory-wide deletion, and database down migrations are out of scope.
