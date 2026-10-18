import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/storybook',
  outputDir: './.cache/storybook-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  timeout: 30000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:6041',
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  webServer: {
    command:
      'pnpm build-storybook && node scripts/serve-site.mjs --dir storybook-static --port 6041',
    url: 'http://127.0.0.1:6041',
    reuseExistingServer: false,
    timeout: 180000,
  },
})
