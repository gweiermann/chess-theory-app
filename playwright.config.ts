import { defineConfig, devices } from '@playwright/test'

const E2E_MAX_WAIT_MS = 2000

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: E2E_MAX_WAIT_MS,
  },
  // Each test gets its own browser context; chess-app.fixture clears storage once per context.
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    // VITE_E2E enables the dev-play bridge (a test seam, not user-visible) so
    // the canonical move hint is available in the SSG build used by Playwright.
    command: 'VITE_E2E=1 pnpm generate && npx serve -l 3000 .output/public',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
