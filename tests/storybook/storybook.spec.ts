import { test, expect } from '@playwright/test'

test('static hosting never disguises missing runtime assets as HTML', async ({
  request,
}) => {
  expect((await request.get('/_nuxt/not-present.js')).status()).toBe(404)
  expect((await request.get('/data/not-present.json')).status()).toBe(404)
  const page = await request.get('/client-route')
  expect(page.status()).toBe(200)
  expect(page.headers()['content-type']).toContain('text/html')
  const index = await request.get('/index.json')
  expect(index.headers()['content-type']).toContain('application/json')
})

const stories = [
  ['training-compactpanel--punish', '[data-testid="training-phase"]'],
  ['board-boardview--animated-moves', '[data-testid="square-a8"]'],
  ['openings-librarybrowser--browse', '[aria-label="Vollständige Varianten"]'],
  ['board-boardview--queued-sequence', '[data-testid="square-c4"]'],
  ['board-boardview--touch-drag', '[data-testid="square-e2"]'],
  ['training-compactpanel--recall', '[data-testid="training-phase"]'],
  ['training-compactpanel--completion', '[data-testid="round-complete"]'],
  ['board-boardview--white', '[data-testid="square-e4"]'],
  ['board-boardview--promotion', '[aria-label="Bauernumwandlung"]'],
  ['board-boardview--help', '[data-testid="square-e2"]'],
  ['board-boardview--exploration', '[data-testid="square-c2"]'],
  [
    'openings-librarybrowser--learned-variations',
    '[data-testid="line-classical"]',
  ],
  ['openings-librarybrowser--load-failure', '[role="alert"]'],
  ['learning-settingspanel--adjust-training', 'button[type="submit"]'],
  [
    'learning-settingspanel--recent-practice',
    'button[aria-label="Erneut üben: Italian Game: Classical Variation mit Weiß"]',
  ],
  ['learning-settingspanel--invalid-repetitions', '[role="alert"]'],
]

for (const [id, canvas] of stories) {
  test(`${id} renders and completes its interaction checks`, async ({
    page,
  }) => {
    await page.goto(`/iframe.html?id=${id}&viewMode=story`)
    await expect(page.locator(canvas!)).toBeVisible()
    await expect
      .poll(
        async () =>
          page.evaluate((storyId) => {
            return (
              globalThis as typeof globalThis & {
                __storyResults?: Record<string, string>
              }
            ).__storyResults?.[storyId!]
          }, id),
        { message: 'Storybook play function must finish successfully' },
      )
      .toBe('success')
    if (id === 'board-boardview--help')
      await expect(page.locator('svg.arrows g')).toHaveAttribute(
        'stroke',
        '#477eaa',
      )
    if (id === 'board-boardview--exploration')
      await expect(page.locator('svg.arrows g')).toHaveAttribute(
        'stroke',
        '#348257',
      )
  })
}
