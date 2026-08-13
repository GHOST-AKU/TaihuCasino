# Supabase Maintenance / Supabase 数据维护

## Issue #47 Historical Smoke-data Cleanup

Prepared artifact: [`issue-47-smoke-data-cleanup.sql`](./issue-47-smoke-data-cleanup.sql)

Status: engineering inventory/rehearsal procedure prepared; **no live database deletion has been performed**. Issue #47 remains incomplete until an authorized Database Operator executes a separately approved window and attaches redacted evidence.

Observed development evidence (2026-08-13): a transactionally guarded attempt against three exact smoke push sessions in the development Supabase project failed the protected progress-field invariant (consistent with an `updated_at` trigger side effect). The entire transaction rolled back and deleted nothing. This is a useful fail-closed result, **not** a passed rehearsal and not completion of Issue #47.

## Safety Model / 安全模型

The repository SQL defaults to a sentinel user/window, `apply_deletes=false`, `expected_manifest_sha256='NOT_FROZEN'`, and a final `ROLLBACK`.

It has three deliberately separate modes:

1. **Phase 1 inventory**: builds temporary candidate/manifests with read queries only. The `DELETE` statements live inside an `if cfg.apply_deletes then` PL/pgSQL branch, so inventory does not execute or plan them and does not acquire their `RowExclusiveLock` table locks.
2. **Phase 2 apply rehearsal**: requires Phase 1's exact count object and full-row manifest SHA-256, blocks concurrent writes to the five candidate tables, locks the target user's wallet/progress rows, executes guarded deletes inside the transaction, verifies postconditions, then reaches the repository copy's final `ROLLBACK`.
3. **Live execution**: a separately reviewed copy used only in an approved maintenance window. It repeats all apply gates and changes only the final transaction outcome to `COMMIT`.

Do not combine these phases into one run. A fresh Phase 1 is required after every guard failure, row update, count change, or candidate edit.

## Exact Candidate Boundary / 精确候选边界

Rows require all applicable anchors:

- one exact `auth.users.id` and exact verified email;
- one half-open UTC window `[window_start, window_end)` no longer than seven days;
- one or more unique literal `e2e-`, `smoke-`, or `ci-` idempotency prefixes;
- for `member_events`, explicit exact event UUIDs supplied in `exact_event_ids`.

Prefix matching uses `left(value, length(prefix)) = prefix`, never `LIKE`, so `%` and `_` cannot widen a filter.

`member_events` has no reliable round/session foreign key. The script therefore never infers events from `title`, `outcome`, timestamps alone, or similar text. An event not present in the exact UUID list cannot be deleted. Every requested event UUID must resolve to the exact target user and window or apply fails.

The known local fallback account `demo@taihu.casino` is allowed only when all of these are true:

- its exact UUID is supplied;
- `expected_email` exactly matches `demo@taihu.casino`;
- `allow_known_demo_account=true` is explicit;
- Phase 1 counts and manifest hash are frozen and match at apply time.

The email address alone never selects an account.

## Tables in Scope / 表范围

The candidate manifest may contain:

- `member_events` from explicit event UUIDs only;
- `member_blackjack_round_states`, including session/final-round closure;
- `member_game_rounds`;
- `member_table_sessions`;
- `member_wallet_ledger`, including both `reference_id` and session ledger-column dependencies.

The SQL never deletes users, profiles, wallets, progress, settings, consents, deletion requests, purchases, ad rewards, rate-limit buckets, or security events.

## Economic and Progress Fail-closed Rules / 账本与进度门禁

This generic maintenance script does **not** attempt to reconstruct wallet or game-progress history. Apply is rejected unless deletion is provably neutral:

- every candidate game round is `rejected` or `voided`, with both `delta=0` and `total_stake=0`; a settled round is treated as progress-affecting even when its financial delta is zero;
- candidate ledger amounts sum exactly to zero;
- the existing ledger chain is continuous by `(created_at, id)`;
- removing candidate ledger rows leaves a continuous retained chain;
- at least one retained ledger row remains when ledger candidates exist, and its tail balance equals `member_wallets.balance`;
- no active candidate table session or blackjack state exists;
- every ledger ID stored on a candidate session is itself inside the exact candidate ledger set;
- no non-candidate round, blackjack state, session, or ledger row points into the candidate dependency set;
- `member_wallets.balance` and the complete target-user `member_game_progress` hash remain unchanged after the rehearsal delete.

This means ordinary settled smoke rounds will intentionally fail apply. Cleaning those records needs a separate, schema-aware forward repair that transactionally recomputes progress and proves the ledger/session invariants. Do not weaken this script to make a desired row count pass.

## Phase 0 — Authorize and Identify

Before opening the SQL editor:

- assign Database Operator, Reviewer, and Release/Incident Owner;
- confirm the exact disposable test user UUID and exact email;
- derive the narrow UTC window from build/test evidence;
- list literal idempotency prefixes observed in that run;
- independently query and review exact `member_events.id` values, or keep `exact_event_ids` explicitly empty;
- create a provider backup/PITR reference appropriate to the environment;
- choose a maintenance window and communication channel;
- confirm no candidate session/state is active.

Never infer a target from display name, email domain alone, newest row, broad date predicates, or event text.

## Phase 1 — Read-only Inventory (Required)

1. Copy the repository SQL into the Supabase SQL Editor or run with a privileged `psql` session using `ON_ERROR_STOP`.
2. Replace only the identity/window/prefix/event-manifest inputs. For the known demo account, also set the explicit demo allowance.
3. Keep all apply fields at safe defaults:

   ```sql
   expected_counts = '{}'::jsonb
   expected_manifest_sha256 = 'NOT_FROZEN'
   apply_deletes = false
   confirmation_token = 'NOT_APPROVED'
   rollback;
   ```

4. Execute once. Export to a restricted evidence location:
   - `candidate_counts` JSON;
   - `manifest_sha256`;
   - exact table/record UUID and per-row SHA-256 manifest;
   - candidate round/session detail;
   - every invariant result.
5. Reviewer confirms every ID belongs to the named test run and every invariant violation is zero.

The manifest SHA-256 is derived from sorted table name, exact UUID, and the SHA-256 of the complete row JSON. Any selected row update, insertion/deletion, dependency change, or input change invalidates it.

Inventory does not delete rows. The final `ROLLBACK` also drops temporary tables and ends the read transaction.

## Phase 2 — Frozen Apply Rehearsal (Required)

Start with a fresh copy and the exact same identity/window/prefix/event inputs:

1. Paste Phase 1's complete `candidate_counts` JSON into `expected_counts`.
2. Paste Phase 1's 64-character lowercase `manifest_sha256` into `expected_manifest_sha256`.
3. Set:

   ```sql
   apply_deletes = true
   confirmation_token = 'ISSUE-47-DELETE-REVIEWED'
   ```

4. Keep the final `rollback;` unchanged.
5. Execute once during the approved rehearsal window.

Apply stops before any `DELETE` if counts, row fingerprints, dependencies, exact events, or invariants drift. If guards pass, deletes run in foreign-key-safe order; remaining candidate counts, wallet/progress snapshots, ledger continuity, and ledger tail are verified; the repository copy then rolls the transaction back.

Save the complete rehearsal output. Although it rolls back, the apply branch takes write locks, so it must not be treated as read-only inventory.

If a trigger or other database behavior changes any protected progress/wallet field during rehearsal, the correct result is a full rollback. A future schema-aware cleanup must account for that behavior explicitly; do not exclude the field from the hash or disable the trigger merely to make cleanup pass.

## Live Execution (Human-operated, Not Done Here)

Only after Phase 1 and Phase 2 evidence are approved:

1. Re-run Phase 1 immediately and compare its counts/hash to the approved evidence.
2. Stop on any difference or active state; repeat review rather than updating the expected values casually.
3. Use the approved Phase 2 copy with both exact freeze fields and both apply gates.
4. Change only the final `rollback;` to `commit;` in that reviewed operational copy.
5. Database Operator executes once while Reviewer watches the exact output.
6. Re-run Phase 1 with identical anchors; candidate counts must be zero.
7. Verify non-candidate samples, wallet balance, ledger tail/continuity, and progress hash.
8. Record operator, reviewer, UTC window, source commit, SQL checksum, backup/PITR reference, before/after counts, frozen hash, invariant output, and incident link if any.

Do not post raw UUIDs, emails, ledger metadata, IPs, tokens, or secrets in a public issue. Use a restricted evidence location and a redacted public summary.

## Abort and Recovery

- Before commit: `ROLLBACK` and record the exact guard/invariant that stopped execution.
- After an unexpected live commit: stop further changes, preserve logs, notify the Incident Commander, and use the provider backup/forward-repair process. Do not improvise reverse deletes or rewrite migrations.
- This maintenance SQL is not a migration and must never be copied into `supabase/migrations/` after execution.

## Evidence Template

```text
Issue: #47
Outcome: NOT RUN | INVENTORY ONLY | REHEARSAL ROLLED BACK | ABORTED | COMPLETED | INCIDENT
Environment/project ref:
Source commit and SQL SHA-256:
Database Operator / Reviewer:
Exact UTC half-open window:
Restricted exact UUID/email evidence:
allow_known_demo_account:
Literal idempotency prefixes:
Restricted exact event ID manifest:
Backup/PITR reference:
Phase 1 candidate_counts:
Phase 1 manifest_sha256:
Phase 1 invariant result:
Phase 2 frozen-count/hash match:
Phase 2 rollback rehearsal result:
Live approval link:
Live execution UTC timestamp:
Post-run zero-candidate result:
Retained ledger continuity/tail result:
Wallet/progress unchanged result:
Non-candidate sample result:
```

`NOT RUN` is the current and correct outcome until a human-operated database step actually occurs.
