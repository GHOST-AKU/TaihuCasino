import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3026)
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? (process.env.CI ? undefined : "chrome")

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]] : "list",
  outputDir: "test-results/e2e",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: `corepack pnpm dev --hostname 127.0.0.1 -p ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
          NEXT_PUBLIC_SUPABASE_URL: "",
          SUPABASE_SERVICE_ROLE_KEY: "",
          TAIHU_AUTH_ACCOUNT: "e2e@taihu.casino",
          TAIHU_AUTH_PASSWORD: "not-a-secret-e2e-password",
          TAIHU_AUTH_USERS: JSON.stringify([
            {
              account: "e2e@taihu.casino",
              password: "not-a-secret-e2e-password",
              displayName: "E2E Member",
            },
          ]),
          TAIHU_RATE_LIMIT_SECRET: "not-a-secret-local-e2e-rate-limit-secret",
          TAIHU_SESSION_SECRET: "not-a-secret-local-e2e-session-secret",
        },
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
})
