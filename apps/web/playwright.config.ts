import { defineConfig, devices } from "@playwright/test"

const port = process.env.E2E_WEB_PORT ?? "4017"
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://contextbase:contextbase_dev_only@127.0.0.1:5417/contextbase"
const webServer =
  process.env.E2E_SKIP_WEB_SERVER === "1"
    ? undefined
    : {
        command: `pnpm build && DATABASE_URL=${databaseUrl} PORT=${port} pnpm start`,
        reuseExistingServer: true,
        timeout: 60_000,
        url: baseURL,
      }

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  testDir: "./e2e",
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
  },
  webServer,
})
