# Release Checklist / 发布清单

Operator source of truth / 执行手册：[`RELEASE_ROLLBACK_RUNBOOK.md`](../RELEASE_ROLLBACK_RUNBOOK.md)

This page is the short checklist. Owner assignments, exact version evidence, forward-only database procedure, trigger definitions, communication templates, and tabletop evidence are mandatory in the full runbook.

## Release Record / 发布记录

- [ ] Release Owner, Deployment Operator, Database Operator, Validator, Incident Commander, and Communications Owner are named.
- [ ] Candidate 40-character SHA, deployment ID/URL, previous known-good SHA/deployment, production hostname, and migration head are recorded.
- [ ] Scope, risk, observation window, rollback deadline, and product profile are recorded.
- [ ] The deployment provider shows the same candidate SHA; branch name alone is not accepted.

## GO/NO-GO / 发布门禁

- [ ] Required checks for the exact SHA are green: quality, API/security regression, production build, and Playwright E2E.
- [ ] Required environment/configuration is present without exposing secret values in evidence.
- [ ] Auth Site URL, redirects, enabled OAuth providers, CAPTCHA, and password-reset configuration match the production hostname.
- [ ] Issue #54 manual gates are evidenced: rate-limit secret, Supabase Auth rate limits/CAPTCHA, cleanup, and security-event monitoring.
- [ ] Issue #55 manual gates are evidenced: final legal text, launch regions, age threshold, support contact, retention/deletion rules, and human review.
- [ ] Missing email/provider or legal setup is marked unavailable/`NO-GO`; a placeholder or form-only check is not called complete.
- [ ] Pending Issue #61 causes no broad rename or deletion; stable game IDs/contracts/schema remain independent from display branding.

## Database / 数据库

- [ ] Current and expected migration filenames are recorded.
- [ ] Migration is classified as none, backward-compatible, or forward-fix-required.
- [ ] A compensating/compatibility migration is prepared when needed.
- [ ] Backup/PITR reference and operator are recorded.
- [ ] No applied migration is edited and no live `down.sql` is used as first response.
- [ ] Issue #47 cleanup, if ever run, has its own separately approved maintenance window and evidence.

## Promotion and One Validation Pass / 发布与一次验收

- [ ] Promote only the deployment matching the recorded SHA.
- [ ] Record promotion timestamp, live deployment ID, and observed migration head.
- [ ] Validate public legal/support routes, configured auth/session behavior, one authoritative game round with replay safety and cash-out, security rejection, request IDs, and error logs.
- [ ] When blackjack changed, validate active-round restore and active cash-out rejection.
- [ ] Send release success with known manual limitations and observation-window end.

## Rollback / 回滚

Immediate review triggers include any unauthorized/duplicate balance movement, cross-user access, hidden blackjack state exposure, security limiter fail-open, legal/age bypass, version mismatch, or incompatible application/schema state.

- [ ] Incident Commander declares rollback/containment and freezes further promotion.
- [ ] Communications Owner sends impact, trigger, action, and next-update time.
- [ ] For app-only/backward-compatible changes, restore the recorded previous deployment and verify its SHA.
- [ ] For incompatible schema changes, use the prepared forward compatibility fix; do not blindly deploy old code or improvise destructive SQL.
- [ ] Run the rollback acceptance pass once and record restored SHA/deployment, migration state, invariants, timestamps, and follow-up issue.

## Exercise / 演练

- [x] Complete a no-production-change tabletop exercise using [`RELEASE_TABLETOP_EXERCISE_EVIDENCE.md`](../templates/RELEASE_TABLETOP_EXERCISE_EVIDENCE.md).
- [x] Exercise evidence explicitly says it does not prove provider, email, legal, database, or live rollback completion.
- Repository walkthrough evidence: [`2026-08-13-release-rollback-tabletop.md`](../evidence/2026-08-13-release-rollback-tabletop.md) (`PASS WITH ACTIONS`; production gates remain open).

## References / 参考文档

- [Release and rollback runbook](../RELEASE_ROLLBACK_RUNBOOK.md)
- [Deployment readiness](../DEPLOYMENT_READINESS.md)
- [Observability runbook](../OBSERVABILITY_RUNBOOK.md)
- [Legal review checklist](../LEGAL_REVIEW_CHECKLIST.md)
- [Issue #47 maintenance runbook](../../supabase/maintenance/README.md)
