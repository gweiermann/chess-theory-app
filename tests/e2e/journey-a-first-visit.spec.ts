/**
 * PRD: §4.1 Journey A (A1–A4), §3.3 navigation, primary CTA reachability.
 */
import { expect, test } from './fixtures/chess-app.fixture'
import { SPA_WAIT_UNTIL } from './helpers/prd-constants'

test('A1 root navigates to /learn', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('load')
  await page.waitForURL(/\/learn$/, { waitUntil: SPA_WAIT_UNTIL })
  await expect(page).toHaveURL(/\/learn$/)
})

test('A2 learn hub shows mode list with openings-learn card', async ({ learnHub }) => {
  await learnHub.goto()
  await expect(learnHub.page.getByRole('heading', { name: 'Modus wählen' })).toBeVisible()
  await expect(learnHub.modeCard('openings')).toBeVisible()
})

test('A3 Spielen navigates to /learn/play', async ({ learnHub, page }) => {
  await learnHub.goto()
  await learnHub.playButton().click()
  await page.waitForURL(/\/learn\/play$/, { waitUntil: SPA_WAIT_UNTIL })
  await expect(page).toHaveURL(/\/learn\/play$/)
})

test('A4 disabled modes show coming-soon copy', async ({ learnHub }) => {
  await learnHub.goto()
  // Random Opening Trainer is live; only error-trainer stays as coming-soon.
  await expect(learnHub.modeCard('random')).toBeEnabled()
  await expect(learnHub.modeCard('error-trainer')).toBeDisabled()
  await expect(learnHub.page.getByText('Demnächst')).toHaveCount(1)
})

test('§3.3 bottom navigation switches tabs', async ({ appLayout, page }) => {
  await page.goto('/learn')
  await page.waitForLoadState('load')
  await page.getByRole('link', { name: 'Eröffnungen' }).waitFor({ state: 'visible' })
  await appLayout.goOpenings()
  await page.waitForURL(/\/openings$/, { waitUntil: SPA_WAIT_UNTIL })
  await expect(page).toHaveURL(/\/openings$/)
  await appLayout.goProfile()
  await page.waitForURL(/\/profile$/, { waitUntil: SPA_WAIT_UNTIL })
  await expect(page).toHaveURL(/\/profile$/)
  await appLayout.goLearn()
  await page.waitForURL(/\/learn$/, { waitUntil: SPA_WAIT_UNTIL })
  await expect(page).toHaveURL(/\/learn$/)
})

test('A-risk primary CTA is in viewport on mobile', async ({ learnHub, page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await learnHub.goto()
  const btn = learnHub.playButton()
  await expect(btn).toBeVisible()
  const box = await btn.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.y + box!.height).toBeLessThanOrEqual(844 + 8)
})
