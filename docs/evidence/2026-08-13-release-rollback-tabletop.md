# Release/Rollback Tabletop Evidence — 2026-08-13

Result: **PASS WITH ACTIONS**. This was a repository-only, no-production-change exercise. It did not deploy, roll back, change provider configuration, send email, approve legal text, or modify live data.

## Identity and roles

- Exercise ID: `tabletop-2026-08-13-issue-45`
- Facilitator / simulated Release Owner: Codex
- Simulated Deployment Operator / Database Operator / Incident Commander: Codex, using separate checklist passes
- Validator: formal repository contracts reserved for the final verification pass; no production validation claimed here
- Repository: `GHOST-AKU/TaihuCasino`
- Example candidate baseline: `ff89d5826fc4fd5f7b1efa8e7a9eec5b6d407070`
- Example previous deployment: `vercel:previous-known-good` (hypothetical identifier)
- Example candidate deployment: `vercel:candidate-sha-mismatch` (hypothetical identifier)
- Scenario: candidate identity mismatch, then two authoritative-settlement failures after a backward-compatible migration

## Walkthrough record

| Step | Inject | Decision and runbook result | Outcome |
| --- | --- | --- | --- |
| 1 | Candidate deployment reports a SHA different from the release record | Release Owner records `NO-GO`; no promotion occurs. The branch name is not accepted as version evidence. | PASS |
| 2 | Provider UI contains no recorded previous deployment ID | Deployment Operator must locate and copy the immutable ID before `GO`; friendly hostname alone is insufficient. | PASS WITH ACTION |
| 3 | Hypothetical migration is additive and backward-compatible | Database Operator keeps the forward migration in place and selects application-only restore; no down migration is attempted. | PASS |
| 4 | Two consecutive authoritative settlement checks fail after promotion | Incident Commander freezes promotion, starts incident communication, and selects the recorded previous deployment. | PASS |
| 5 | Previous application deployment is restored | Operator verifies the restored deployment reports the recorded previous SHA before validation begins. | PASS |
| 6 | Rollback validation | Validator performs one bounded pass: public legal/support routes, enabled auth only, one buy-in/authoritative round/replay/cash-out flow, request IDs, and error scan. | PASS (procedure only) |
| 7 | `TAIHU_RATE_LIMIT_SECRET` / CAPTCHA evidence is absent | Issue #54 stays a production `NO-GO`; the tabletop cannot waive it. | PASS |
| 8 | Region, age, legal text, contact, and retention approvals are absent | Issue #55 stays a production `NO-GO`; draft pages are not treated as approval. | PASS |
| 9 | Issue #61 is undecided | No Taihu-to-OGO mass rename or deletion is performed; stable game and persistence identifiers remain unchanged. | PASS |

## Communication artifacts produced

```text
[RELEASE START] tabletop-2026-08-13-issue-45
Candidate: vercel:candidate-sha-mismatch
Scope: hypothetical release/rollback exercise only
Owner: Codex (simulation)
Boundary: no production changes
```

```text
[RELEASE INCIDENT] tabletop-2026-08-13-issue-45
Impact: hypothetical authoritative settlement check failed twice
Containment: freeze promotion; select recorded previous deployment
Data integrity: no live data involved in this exercise
```

```text
[RELEASE RESOLVED] tabletop-2026-08-13-issue-45
State: ROLLED_BACK (simulated)
Application: previous immutable deployment selected and SHA checked
Database: backward-compatible forward migration retained
Validation: one bounded procedure walkthrough completed
```

## Findings and actions

| Severity | Finding | Required action before production | Status |
| --- | --- | --- | --- |
| High | #54 external configuration evidence is absent | Named operator verifies secret, Supabase Auth limits/CAPTCHA, cleanup, and monitoring | OPEN / external gate |
| High | #55 legal and regional approvals are absent | Named reviewers approve region, age, final text, support contact, and retention/deletion rules | OPEN / external gate |
| Medium | Exercise used hypothetical deployment IDs | Next real release record must capture actual immutable candidate and previous deployment IDs before `GO` | OPEN / release-time action |
| Medium | #61 product decision is pending | Keep branding changes presentation-only and preserve stable contracts until approved | OPEN / decision gate |

The exercise demonstrates that the runbook selects the correct stop, application restore, or forward-fix branch and produces the required communications. It is not evidence of a real provider rollback or a production release.
