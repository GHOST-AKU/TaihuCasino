import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

async function readRepoFile(path) {
  return readFile(join(repoRoot, path), "utf8")
}

async function recursiveFiles(path) {
  const root = join(repoRoot, path)
  const entries = await readdir(root, { withFileTypes: true, recursive: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(repoRoot, join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .sort()
}

function executableSql(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*--.*$/gm, "")
}

test("Issue #43 matrix assigns every pages/ and assets/ file", async () => {
  const matrix = await readRepoFile("docs/LEGACY_MIGRATION_MATRIX.md")
  const legacyFiles = [
    ...(await recursiveFiles("pages")),
    ...(await recursiveFiles("assets")),
  ]

  assert.equal(legacyFiles.length, 22)
  for (const path of legacyFiles) {
    assert.ok(matrix.includes(`\`${path}\``), `missing legacy inventory row for ${path}`)
  }

  assert.match(matrix, /M1/)
  assert.match(matrix, /M2/)
  assert.match(matrix, /M3/)
  assert.match(matrix, /Issue #61/)
  assert.match(matrix, /no files were migrated or retired/i)
})

test("Issue #47 SQL is guarded, bounded, and rollback-default", async () => {
  const sql = await readRepoFile("supabase/maintenance/issue-47-smoke-data-cleanup.sql")
  const maintenanceReadme = await readRepoFile("supabase/maintenance/README.md")
  const executable = executableSql(sql)

  assert.match(executable, /^\s*begin;/i)
  assert.match(executable, /'00000000-0000-0000-0000-000000000000'::uuid/)
  assert.match(executable, /apply_deletes\s+boolean\s+not null\s+default false/i)
  assert.match(executable, /'ISSUE-47-DELETE-REVIEWED'/)
  assert.match(executable, /window_end\s+-\s+cfg\.window_start\s+>\s+interval '7 days'/i)
  assert.match(executable, /exact_event_ids\s+uuid\[\]\s+not null/i)
  assert.match(executable, /event_row\.id\s*=\s*requested\.event_id/i)
  assert.doesNotMatch(executable, /event_row\.(title|detail)/i)
  assert.match(executable, /allow_known_demo_account\s+boolean\s+not null\s+default false/i)
  assert.match(executable, /lower\(actual_email\)\s*=\s*'demo@taihu\.casino'/i)
  assert.match(executable, /member_blackjack_round_states/i)
  assert.match(executable, /no_active_candidate_blackjack_states/i)
  assert.match(executable, /no_non_candidate_session_references_candidate_ledger/i)
  assert.match(executable, /candidate_sessions_do_not_reference_non_candidate_ledger/i)
  assert.match(executable, /no_non_candidate_ledger_references_candidate_session_or_round/i)
  assert.match(executable, /candidate_rounds_have_zero_progress_and_chip_effect/i)
  assert.match(executable, /candidate_ledger_net_amount_is_zero/i)
  assert.match(executable, /retained_ledger_chain_is_continuous/i)
  assert.match(executable, /retained_ledger_tail_matches_wallet/i)

  assert.match(executable, /expected_counts\s+jsonb\s+not null\s+default '\{\}'::jsonb/i)
  assert.match(executable, /expected_manifest_sha256\s+text\s+not null\s+default 'NOT_FROZEN'/i)
  assert.match(executable, /cfg\.expected_counts\s*<>\s*summary\.candidate_counts/i)
  assert.match(executable, /cfg\.expected_manifest_sha256\s*<>\s*summary\.manifest_sha256/i)
  assert.match(executable, /digest\(convert_to\(to_jsonb\(event_row\)::text/i)

  const allDeletes = executable.match(/\bdelete\s+from\b/gi) ?? []
  const conditionalBodies = [...executable.matchAll(/if\s+cfg\.apply_deletes\s+then([\s\S]*?)end if;/gi)]
    .map((match) => match[1])
  const applyDeleteBody = conditionalBodies.find((body) => /\bdelete\s+from\b/i.test(body))

  assert.equal(allDeletes.length, 5)
  assert.ok(applyDeleteBody, "DELETE statements must exist only inside an apply-only branch")
  assert.equal((applyDeleteBody.match(/\bdelete\s+from\b/gi) ?? []).length, allDeletes.length)
  assert.equal((applyDeleteBody.match(/execute\s+\$delete\$/gi) ?? []).length, allDeletes.length)
  assert.match(executable, /lock table[\s\S]*in share row exclusive mode/i)
  assert.match(executable, /from public\.member_wallets[\s\S]*where user_id = \$1[\s\S]*for update/i)
  assert.match(executable, /from public\.member_game_progress[\s\S]*where user_id = \$1[\s\S]*for update/i)

  assert.doesNotMatch(executable, /\bcommit\s*;/i)
  assert.match(executable, /rollback;\s*$/i)
  assert.match(maintenanceReadme, /no live database deletion has been performed/i)
  assert.match(maintenanceReadme, /ordinary settled smoke rounds will intentionally fail apply/i)
  assert.match(maintenanceReadme, /does not execute or plan them/i)
  assert.match(maintenanceReadme, /entire transaction rolled back and deleted nothing/i)

  for (const protectedTable of [
    "auth.users",
    "public.profiles",
    "public.member_wallets",
    "public.member_game_progress",
    "public.member_settings",
    "public.member_consents",
    "public.account_deletion_requests",
    "public.api_rate_limit_buckets",
    "public.security_events",
  ]) {
    assert.doesNotMatch(
      executable,
      new RegExp(`delete\\s+from\\s+${protectedTable.replace(".", "\\.")}\\b`, "i"),
    )
  }
})

test("release runbook preserves manual and product-decision gates", async () => {
  const runbook = await readRepoFile("docs/RELEASE_ROLLBACK_RUNBOOK.md")
  const wiki = await readRepoFile("docs/wiki/Release-Checklist.md")
  const readme = await readRepoFile("README.md")

  for (const issue of ["Issue #54", "Issue #55", "Issue #61"]) {
    assert.match(runbook, new RegExp(issue))
  }

  assert.match(runbook, /forward-only/i)
  assert.match(runbook, /Release Owner/)
  assert.match(runbook, /previous production deployment/i)
  assert.match(runbook, /tabletop/i)
  assert.match(wiki, /RELEASE_ROLLBACK_RUNBOOK\.md/)
  assert.match(readme, /RELEASE_ROLLBACK_RUNBOOK\.md/)
})
