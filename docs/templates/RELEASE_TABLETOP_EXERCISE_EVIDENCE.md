# Release/Rollback Tabletop Exercise Evidence / 发布回滚桌面演练证据

This template records a no-production-change rehearsal. It is not evidence that a real provider, email flow, migration, rollback, or legal review was completed.

## Exercise Identity

```text
Exercise ID:
Date/time (UTC):
Facilitator:
Participants and assigned roles:
Repository/source SHA used as example:
Hypothetical candidate deployment ID:
Hypothetical previous deployment ID:
Hypothetical migration head before/after:
Scenario:
Explicit boundary: NO production changes and NO live data deletion
```

## Inject Timeline

| UTC time | Inject/fact presented | Owner decision | Runbook section used | Evidence/link |
| --- | --- | --- | --- | --- |
| | Candidate SHA differs from deployment SHA | | | |
| | Authoritative settlement synthetic check fails twice | | | |
| | Migration is additive/backward-compatible **or** incompatible (choose one) | | | |
| | #54 production secret/CAPTCHA evidence is missing | | | |
| | #55 target-region/legal approval is missing | | | |
| | Communications deadline arrives | | | |

## Required Demonstrations

- [ ] Participant identifies the exact candidate SHA and previous known-good SHA.
- [ ] Participant finds the exact deployment IDs without promoting either deployment.
- [ ] Database Operator explains why migration history is forward-only.
- [ ] Team chooses app restore or forward compatibility fix based on schema compatibility.
- [ ] Validator names the single post-action validation pass and its evidence location.
- [ ] Observer locates a sample request ID in logs without exposing secrets/user PII.
- [ ] Team leaves #54/#55 human gates incomplete when evidence is absent.
- [ ] Team explains how pending #61 avoids a broad rename during rollback.
- [ ] Start, incident, success/rollback, and resolution messages are drafted.

## Evidence Index

```text
Candidate/version command output:
Deployment-screen capture or redacted export:
Migration compatibility review:
Sample observability query/result:
Draft communications:
Decision log:
```

Do not attach service-role keys, HMAC secrets, SMTP credentials, OAuth secrets, raw IPs, cookies, access tokens, or raw user identifiers.

## Findings and Actions

| Severity | Finding | Owner | Follow-up issue | Due date | Status |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Result

```text
Result: PASS | PASS WITH ACTIONS | FAIL
Reason:
Release Owner sign-off:
Validator sign-off:
Next exercise date:
```

`PASS` means the runbook was executable in the rehearsal. It does not clear production configuration, legal, regional, email-provider, database, or Issue #61 decision gates.
