import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8")
}

test("legal and support pages are public and visibly marked as drafts", async () => {
  const [proxy, legalPage, legal, terms, privacy, responsible, support] = await Promise.all([
    source("../proxy.ts"),
    source("../components/legal-page.tsx"),
    source("../lib/legal.ts"),
    source("../app/terms/page.tsx"),
    source("../app/privacy/page.tsx"),
    source("../app/responsible-gaming/page.tsx"),
    source("../app/support/page.tsx"),
  ])

  for (const route of ["/terms", "/privacy", "/responsible-gaming", "/support"]) assert.match(proxy, new RegExp(route.replace("/", "\\/")))
  assert.match(legalPage, /LEGAL_DRAFT_STATUS/)
  assert.match(legal, /pending legal and product review/i)
  assert.match(terms, /not an online real-money casino/i)
  assert.match(privacy, /HMAC-hashed identifiers/i)
  assert.match(responsible, /numeric minimum age will not be claimed/i)
  assert.match(support, /does not invent a contact address/i)
})

test("footer and login links point to real public routes and unsupported marketing numbers are removed", async () => {
  const [home, gameFrame, login] = await Promise.all([
    source("../components/player-home-page.tsx"),
    source("../components/member-game-frame.tsx"),
    source("../app/login/login-form.tsx"),
  ])

  for (const route of ["/terms", "/privacy", "/support"]) {
    assert.match(home, new RegExp(route))
    assert.match(gameFrame, new RegExp(route))
  }
  for (const route of ["/terms", "/privacy"]) assert.match(login, new RegExp(route))
  assert.equal(login.includes("50K+"), false)
  assert.equal(login.includes("$2M+"), false)
  assert.match(login, /No cash value/)
})

test("email registration and OAuth require versioned consent and age eligibility", async () => {
  const [registration, oauth, callback, migration] = await Promise.all([
    source("../app/api/auth/register/route.ts"),
    source("../app/api/auth/oauth/route.ts"),
    source("../app/auth/callback/route.ts"),
    source("../supabase/migrations/20260612193000_member_consents_and_deletion_requests.sql"),
  ])

  for (const code of [registration, oauth]) {
    assert.match(code, /termsAccepted/)
    assert.match(code, /ageAttested/)
  }
  assert.match(registration, /terms_version/)
  assert.match(registration, /privacy_version/)
  assert.match(callback, /member_consents/)
  assert.equal(callback.includes('searchParams.get("termsVersion")'), false)
  assert.match(migration, /terms_version text not null/)
  assert.match(migration, /age_attested boolean not null check \(age_attested\)/)
  assert.match(migration, /revoke all on table public\.member_consents from public, anon, authenticated/)
})

test("data export is authenticated, private, non-cached, and scoped by current user id", async () => {
  const [route, rights] = await Promise.all([
    source("../app/api/member/data-export/route.ts"),
    source("../lib/account-rights.ts"),
  ])

  assert.match(route, /Authentication is required/)
  assert.match(route, /private, no-store/)
  assert.match(route, /content-disposition/)
  assert.match(rights, /\.eq\("user_id", auth\.session\.userId\)/)
  assert.match(rights, /schemaVersion: "taihu-member-export-v1"/)
})

test("account deletion is two-stage, requires recent login and closed table sessions, and never directly deletes the user", async () => {
  const [route, rights, migration] = await Promise.all([
    source("../app/api/member/account-deletion/route.ts"),
    source("../lib/account-rights.ts"),
    source("../supabase/migrations/20260612193000_member_consents_and_deletion_requests.sql"),
  ])

  assert.match(route, /action !== "request".*action !== "confirm".*action !== "cancel"/s)
  assert.match(route, /ACCOUNT_DELETION_CONFIRMATION/)
  assert.match(rights, /Please sign in again before confirming account deletion/)
  assert.match(rights, /Cash out or close active table sessions/)
  assert.match(rights, /awaiting_retention_and_operator_review/)
  assert.equal(rights.includes("deleteUser"), false)
  assert.match(migration, /status in \('requested', 'confirmed', 'canceled', 'completed', 'rejected'\)/)
  assert.match(migration, /revoke all on table public\.account_deletion_requests from public, anon, authenticated/)
})
