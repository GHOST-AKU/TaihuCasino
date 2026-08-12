# Release and Rollback Runbook / 发布与回滚执行手册

Owner: assign a named Release Owner for every release; there is no permanent default owner.

Last updated: 2026-08-13.

Scope: Next.js application, Vercel-compatible hosting, Supabase migrations/configuration, and release communication.

This runbook turns [`DEPLOYMENT_READINESS.md`](./DEPLOYMENT_READINESS.md) into an operator checklist. It does not change CI/CD, authorize production data deletion, approve legal text, or approve the product-direction decision in Issue #61.

## Release States / 发布状态

`DRAFT` -> `CANDIDATE` -> `GO` -> `LIVE`

Terminal alternatives: `ABORTED` before promotion; `ROLLED_BACK` after promotion.

Only the Release Owner may record `GO`. Missing evidence is `NO-GO`, not an implicit waiver.

## Required Roles / 必需职责

One person may hold several roles for a small release, but every cell must contain a name before `GO`.

| Role | Accountable action | Named owner |
| --- | --- | --- |
| Release Owner | Owns scope, GO/NO-GO, version record, and closure | `TBD` |
| Deployment Operator | Promotes or restores the application deployment | `TBD` |
| Database Operator | Applies reviewed forward migrations and verifies schema version | `TBD` |
| Validator | Runs the single agreed verification pass and records evidence | `TBD` |
| Incident Commander | Decides containment/rollback when a trigger fires | `TBD` |
| Communications Owner | Sends start, success, incident, and resolution notices | `TBD` |

The Release Owner and Validator should be different people for production when possible. A release with `TBD` in an action-owning role remains `NO-GO`.

## Canonical Release Record / 权威发布记录

Create one copy of the following block in the release issue, PR, or evidence file. Do not rely on a moving branch name alone.

```text
Release ID:
State: DRAFT | CANDIDATE | GO | LIVE | ABORTED | ROLLED_BACK
Release Owner:
Deployment Operator:
Database Operator:
Validator:
Incident Commander:
Communications Owner:

Source repository: GHOST-AKU/TaihuCasino
Source commit SHA (40 characters):
Annotated tag (if used):
PR(s):
Previous known-good commit SHA:
Candidate deployment URL/ID:
Previous production deployment URL/ID:
Production hostname:
Supabase project ref (never a secret):
Latest migration filename present before release:
Latest migration filename expected after release:
Migration compatibility: none | backward-compatible | forward-fix-required
Prepared compensating migration path/PR (when schema changes):

Product profile: current TaihuCasino | approved OGO transition | other approved decision
Issue #61 decision evidence:
Issue #54 external-gate evidence:
Issue #55 external-gate evidence:
Change window (UTC):
Rollback decision deadline (UTC):
User-visible change summary:
Known risks:
GO/NO-GO decision and timestamp:
```

## 1. Identify the Exact Version / 精确识别版本

Run from a clean checkout using PowerShell 7:

```powershell
git fetch --prune origin
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
git show --no-patch --format=fuller HEAD
git merge-base --is-ancestor HEAD origin/main
```

Expected evidence:

- worktree has no unexplained changes;
- the 40-character candidate SHA is copied into the release record;
- `git merge-base --is-ancestor` exits `0` when the candidate is already contained in `origin/main`, or the release record explains the approved exception;
- the deployment UI/API shows the same source SHA;
- the previous production deployment and SHA are recorded before promotion.

If any identity is ambiguous, stop with `NO-GO`.

## 2. Pre-release GO/NO-GO / 发布前门禁

### Automated evidence

- [ ] Required GitHub checks for the exact SHA are green: quality, API/security regression, production build, and Playwright E2E.
- [ ] Dependency audit evidence belongs to the exact SHA.
- [ ] No generated `.next` output or secret-bearing file is tracked.
- [ ] Release notes identify affected routes, APIs, migrations, and configuration.

The final verification pass is intentionally run once at the end of implementation. Do not substitute repeated ad-hoc testing for missing release evidence.

### Configuration and human approvals

- [ ] Production env values are present in the hosting platform without copying secret values into evidence.
- [ ] Supabase Site URL, redirect allowlist, OAuth providers, CAPTCHA, and password-reset template match the production hostname.
- [ ] A real SMTP/provider check is required before promising password recovery; if the user must configure it, mark that flow `NOT ENABLED` and do not claim it passed.
- [ ] Observability queries and an on-call viewer are ready for the change window.

Issue #54 remains an external production gate until evidence confirms all of the following:

- `TAIHU_RATE_LIMIT_SECRET` exists in Preview/Production;
- Supabase Auth Rate Limits and CAPTCHA settings are confirmed;
- abuse-protection cleanup and `security_events` monitoring are scheduled.

Issue #55 remains an external production gate until named reviewers approve:

- final Terms, Privacy, and Responsible Gaming text;
- target launch regions and age threshold;
- support/complaint contact;
- retention/deletion rules and the human deletion-review process.

Draft pages, placeholder contacts, or an account-deletion queue do not satisfy those approvals.

### Product-direction compatibility (Issue #61)

Issue #61 is still a decision gate and authorizes planning only. Until approved:

- do not perform a codebase-wide Taihu-to-OGO rename;
- do not delete Taihu documents/assets merely because a new name is proposed;
- keep stable game slugs, settlement contracts, persistence keys, and schema names independent of display brand copy;
- record the product profile used for the release so a future UI/design migration can adapt presentation without rewriting financial/game history.

## 3. Database Forward Plan / 数据库前滚计划

Supabase migrations are **forward-only operational history**. Reverting application code does not revert an applied migration.

For every release containing a migration:

1. Database Operator records the current and expected latest migration filename.
2. Review lock level, table rewrite risk, RLS/grant changes, data backfill, and old-app compatibility.
3. Prepare a reviewed compensating migration or compatibility hotfix before `GO` whenever the change is not trivially additive.
4. Confirm a provider backup/PITR point appropriate to the environment and record its identifier; do not copy data into the repository.
5. Apply migrations once through the approved Supabase workflow.
6. Verify expected tables, functions, RLS, grants, and application compatibility; record only non-secret evidence.

Rules:

- Never edit an already-applied migration to simulate rollback.
- Never run a `down.sql` against live data as the first response.
- Prefer additive columns/tables, compatibility views/functions, and expand-then-contract changes.
- Contract/removal waits until the previous application version is outside the rollback window.
- Issue #47 cleanup SQL is a separate, explicitly approved data-maintenance window; it is not silently bundled into a normal release.

## 4. Promotion / 发布执行

1. Communications Owner posts the change-window start notice.
2. Database Operator applies the reviewed forward migrations, if any, and records the observed migration head.
3. Deployment Operator promotes the deployment whose source SHA exactly matches the release record.
4. Release Owner records promotion timestamp and production deployment ID/URL.
5. Validator performs one post-promotion pass:
   - public Terms, Privacy, Responsible Gaming, and Support routes load without authentication;
   - login/session endpoint behaves as configured (do not test unavailable email/OAuth providers as if configured);
   - one approved single-player table completes buy-in -> authoritative round -> replay-safe response -> cash-out;
   - blackjack, when changed, restores an active round and rejects cash-out while active;
   - anonymous/cross-origin/forged-credit requests remain rejected;
   - runtime logs show request IDs and no new high-severity failure pattern.
6. Release Owner records `LIVE` only after the acceptance section below passes.

## 5. Rollback Triggers / 回滚触发条件

Immediate rollback/containment review (one observation is enough):

- unauthorized balance movement, negative balance, duplicate settlement, hidden blackjack state exposure, or cross-user data access;
- required security limiter fails open, required production secret is missing, or authenticated write authorization is bypassed;
- an applied migration makes the previous and current application unable to read/write safely;
- legal/age gate is bypassed in a region that the release record says is protected.

Rollback after confirmation by Incident Commander:

- two consecutive synthetic checks fail for login, table open, authoritative settlement, or cash-out;
- sustained application error rate exceeds the release-record threshold for its observation window;
- latency or availability breaches the pre-recorded threshold and is attributable to the release;
- the deployed SHA/configuration differs from the approved release record.

Thresholds that depend on traffic must be written into the release record before `GO`; do not invent them during an incident.

## 6. Rollback Procedure / 回滚步骤

### Application-only or backward-compatible schema change

1. Incident Commander declares rollback and freezes further promotions.
2. Communications Owner posts the incident notice with impact and next update time.
3. Deployment Operator selects the recorded previous production deployment and promotes/restores it in the hosting platform.
4. Verify the restored deployment reports the recorded previous SHA. Do not assume a friendly URL proves version identity.
5. Keep forward migrations in place when they are backward-compatible.
6. Validator runs the rollback acceptance checks once.
7. Release Owner records `ROLLED_BACK`, timestamps, trigger evidence, restored SHA/deployment, and follow-up issue.

### Schema change that is not backward-compatible

1. Do not blindly promote the old application.
2. Database Operator applies the prepared forward compatibility/compensating migration, or Deployment Operator promotes the prepared compatibility build.
3. If neither prepared path is safe, Incident Commander contains traffic using the hosting/provider controls available to the team and escalates; do not improvise destructive SQL.
4. Restore service only when application/schema compatibility and the invariants below pass.
5. Record every migration and deployment identifier in chronological order.

### External auth/configuration regression

Restore the last approved provider/redirect/CAPTCHA configuration from the provider audit trail, then restore the application only if needed. Never paste client secrets, service-role keys, SMTP credentials, tokens, or raw user identifiers into the incident record.

## 7. Acceptance After Release or Rollback / 发布或回滚验收

- [ ] Production deployment source SHA equals the intended live/restored SHA.
- [ ] Expected migration head is recorded; no migration file was rewritten.
- [ ] Public legal/support routes are reachable.
- [ ] Auth/session behavior matches enabled provider configuration.
- [ ] One approved core table completes an authoritative round and cash-out without duplicate mutation.
- [ ] Wallet/session/round identifiers and balances are internally consistent for the synthetic account.
- [ ] Blackjack has no orphan active state and active-state cash-out protection still works when applicable.
- [ ] Rate-limit/security events and request IDs are queryable.
- [ ] No new high-severity errors appear during the recorded observation window.
- [ ] Success, rollback, or continuing-incident communication has been sent.

## Communication Templates / 沟通模板

### Change-window start

```text
[RELEASE START] <Release ID>
Candidate SHA/deployment: <SHA> / <ID>
Scope: <summary>
Window: <UTC start-end>
Owner: <name>
Risk/rollback target: <summary> / <previous deployment ID>
Next update: <UTC time>
```

### Success

```text
[RELEASE LIVE] <Release ID>
Live SHA/deployment: <SHA> / <ID>
Migration head: <filename or none>
Validation: <evidence link>
Known limitations/manual gates: <#54/#55/#61 status>
Observation window ends: <UTC time>
```

### Incident and rollback

```text
[RELEASE INCIDENT] <Release ID>
Impact: <user-visible facts>
Trigger/time: <trigger> / <UTC>
Containment: <action>
Rollback target: <SHA/deployment ID>
Data integrity status: <confirmed / investigating>
Next update: <UTC time>
Incident Commander: <name>
```

### Resolution

```text
[RELEASE RESOLVED] <Release ID>
State: ROLLED_BACK | LIVE WITH FORWARD FIX
Live SHA/deployment: <SHA> / <ID>
Migration sequence: <filenames or none>
Acceptance evidence: <link>
Follow-up issues: <links>
```

## Tabletop Exercise / 桌面演练

Before relying on this runbook for production, conduct a no-production-change tabletop exercise using [`templates/RELEASE_TABLETOP_EXERCISE_EVIDENCE.md`](./templates/RELEASE_TABLETOP_EXERCISE_EVIDENCE.md).

Completed repository-only exercise: [`evidence/2026-08-13-release-rollback-tabletop.md`](./evidence/2026-08-13-release-rollback-tabletop.md). Its `PASS WITH ACTIONS` result validates the decision procedure only; listed production gates remain open.

The exercise succeeds only when the team can identify both candidate and previous deployments, choose the correct app-only versus forward-fix rollback path, locate logs by request ID, name the #54/#55 manual gates, and produce the four communications without touching live data.

## References / 参考

- [Wiki release checklist](./wiki/Release-Checklist.md)
- [Deployment readiness](./DEPLOYMENT_READINESS.md)
- [Observability runbook](./OBSERVABILITY_RUNBOOK.md)
- [Legal review checklist](./LEGAL_REVIEW_CHECKLIST.md)
- [Issue #47 maintenance runbook](../supabase/maintenance/README.md)
- [Legacy migration matrix](./LEGACY_MIGRATION_MATRIX.md)
