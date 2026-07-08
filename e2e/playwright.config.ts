import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  fullyParallel: false,
  workers: 1, // E2E tests share a single DB, run sequentially to avoid flakiness
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "NODE_ENV=test DATABASE_URL=postgres://koperasi:koperasi_pass@localhost:5432/koperasi_e2e_test JWT_SECRET=e2e-secret bun run server/index.ts > hono.log 2>&1",
      port: 3000,
      reuseExistingServer: !process.env.CI,
      cwd: "..",
    },
    {
      command: "bun run dev --port 5173 --force > vite.log 2>&1",
      port: 5173,
      reuseExistingServer: !process.env.CI,
      cwd: "..",
    },
  ],
});
