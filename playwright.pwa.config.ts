import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/pwa',
  // Upgrade tests replace the generated worker; keep that fixture isolated.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3042/chess-theory-app/',
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'phone',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command:
      'pnpm generate && node scripts/serve-site.mjs --dir .output/public --base /chess-theory-app/ --port 3042',
    env: { NUXT_APP_BASE_URL: '/chess-theory-app/' },
    url: 'http://127.0.0.1:3042/chess-theory-app/',
    reuseExistingServer: false,
    timeout: 180000,
  },
})
