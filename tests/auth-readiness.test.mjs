import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8")
}

test("Discord and Twitch stay inside the explicit OAuth provider allowlist", async () => {
  const [client, route, form] = await Promise.all([
    source("../lib/member-session.ts"),
    source("../app/api/auth/oauth/route.ts"),
    source("../app/login/login-form.tsx"),
  ])

  assert.match(client, /OAuthProviderKey[^\n]+"discord"[^\n]+"twitch"/)
  assert.match(route, /discord:\s*"discord"/)
  assert.match(route, /twitch:\s*"twitch"/)
  assert.match(route, /Unsupported sign-in provider/)
  assert.match(route, /Object\.hasOwn\(providerMap, providerKey\)/)
  assert.match(form, /Continue with \$\{label\}/)
  assert.match(form, /\/brands\/discord-logo\.svg/)
  assert.match(form, /\/brands\/twitch-logo\.svg/)
})

test("OAuth cancellation and callback failures return actionable login states", async () => {
  const [oauth, callback, page, form] = await Promise.all([
    source("../app/api/auth/oauth/route.ts"),
    source("../app/auth/callback/route.ts"),
    source("../app/login/page.tsx"),
    source("../app/login/login-form.tsx"),
  ])

  assert.match(oauth, /errorCode:\s*"provider_unavailable"/)
  assert.match(callback, /provider_denied/)
  assert.match(callback, /callback_failed/)
  assert.match(callback, /url\.searchParams\.set\("provider", provider\)/)
  assert.match(page, /authError=\{params\.authError\}/)
  assert.match(form, /authorization was cancelled/)
  assert.match(form, /invalid or incomplete response/)
})

test("email confirmation resend is CAPTCHA protected, rate limited, and enumeration safe", async () => {
  const [client, route, form] = await Promise.all([
    source("../lib/member-session.ts"),
    source("../app/api/auth/resend-confirmation/route.ts"),
    source("../app/login/login-form.tsx"),
  ])

  assert.match(client, /JSON\.stringify\(\{ email, captchaToken, next \}\)/)
  assert.match(route, /auth\.email-confirmation-resend/)
  assert.match(route, /captchaToken/)
  assert.match(route, /supabase\.auth\.resend\(\{/)
  assert.match(route, /type:\s*"signup"/)
  assert.match(route, /emailRedirectTo:\s*callbackUrl\.toString\(\)/)
  assert.match(route, /If a pending account exists for this email/)
  assert.match(route, /Identity-dependent responses/)
  assert.match(route, /Provider throttling can reveal whether a pending identity exists/)
  assert.match(form, /resendCooldownSeconds/)
  assert.match(form, /Check spam or junk mail|check spam or junk mail/i)
  assert.match(form, /Email verification is still required/)
})

test("expired or invalid verification links expose a recovery action", async () => {
  const [callback, page, form] = await Promise.all([
    source("../app/auth/callback/route.ts"),
    source("../app/login/page.tsx"),
    source("../app/login/login-form.tsx"),
  ])

  assert.match(callback, /loginErrorUrl\("invalid_link"\)/)
  assert.match(callback, /exchangeCodeForSession\(code\)/)
  assert.match(callback, /if \(isPasswordRecovery\)/)
  assert.match(page, /authProvider=\{params\.provider\}/)
  assert.match(form, /verification or sign-in link is invalid or has expired/)
  assert.match(form, /Resend confirmation/)
})
