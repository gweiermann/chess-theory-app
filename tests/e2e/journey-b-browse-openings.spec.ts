/**
 * PRD: §4.2 Journey B (B1–B7), B2 loading/error, B4 Weiter lernen when topic complete.
 */
import { expect, test } from './fixtures/chess-app.fixture'
import { E2E_MAX_WAIT_MS, SPA_WAIT_UNTIL } from './helpers/prd-constants'
import { seedAllLinesMasteredForTopic } from './helpers/seed-topic-mastered'

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
})

test('B1 openings grid lists five topics', async ({ openingsIndex }) => {
  await openingsIndex.goto()
  await expect(openingsIndex.page.getByRole('heading', { name: 'e4', exact: true })).toBeVisible()
  await expect(openingsIndex.page.getByRole('heading', { name: 'd4', exact: true })).toBeVisible()
  await expect(openingsIndex.page.getByRole('heading', { name: 'c4', exact: true })).toBeVisible()
  await expect(openingsIndex.page.getByRole('heading', { name: 'Nf3', exact: true })).toBeVisible()
  await expect(openingsIndex.page.getByRole('heading', { name: 'Andere Eröffnungen' })).toBeVisible()
})

test('B1 topic card opens overview with progress', async ({ openingsIndex, page }) => {
  await openingsIndex.goto()
  await openingsIndex.openTopic('e4')
  await page.waitForURL(/\/openings\/e4$/, { waitUntil: SPA_WAIT_UNTIL })
  await expect(page).toHaveURL(/\/openings\/e4$/)
  await expect(page.getByRole('heading', { level: 1, name: 'e4', exact: true })).toBeVisible()
  await expect(page.getByText(/0 \/ \d+ Eröffnungen/)).toBeVisible()
})

test('B2 shows loading then content or error on index fetch failure', async ({ page }) => {
  await page.route('**/data/openings/index.json', (route) => {
    void route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
  })
  await page.goto('/openings')
  await page.waitForLoadState('load')
  await page.getByText(/Failed to load openings index/).waitFor({ state: 'visible' })
  await expect(page.getByText(/Failed to load openings index/)).toBeVisible({ timeout: E2E_MAX_WAIT_MS })
})

test('B3 topic page shows sections when buckets exist', async ({ openingsTopic, page }) => {
  await openingsTopic.goto('e4')
  await expect(page.locator('[data-section="opening"]')).toBeVisible()
  await expect(page.locator('[data-section="defense"]')).toBeVisible()
  await expect(page.locator('[data-section="gambit"]')).toBeVisible()
})

test('B5 search filters families', async ({ openingsTopic, page }) => {
  await openingsTopic.goto('e4')
  const row = (name: string) => page.getByRole('listitem').filter({ hasText: name })
  await expect(row('Italian Game')).toBeVisible()
  await expect(row('Alekhine Defense')).toBeVisible()
  await openingsTopic.searchInput().fill('alekhine')
  await expect(row('Alekhine Defense')).toBeVisible()
  await expect(row('Italian Game')).toHaveCount(0)
})

test('B6 empty search shows German empty state', async ({ openingsTopic, page }) => {
  await openingsTopic.goto('e4')
  await openingsTopic.searchInput().fill('zzzznonexistent')
  await expect(page.getByText(/Keine Eröffnung gefunden/)).toBeVisible()
})

test('B7 family card opens family page', async ({ openingsTopic, page }) => {
  await openingsTopic.goto('e4')
  await openingsTopic.openFamilyCard('Italian Game')
  await page.waitForURL(/\/openings\/e4\/family\/italian-game$/, { waitUntil: SPA_WAIT_UNTIL })
  await expect(page).toHaveURL(/\/openings\/e4\/family\/italian-game$/)
})

test('B4 continue-learning disabled when all lines in topic mastered', async ({ page, openingsTopic }) => {
  await seedAllLinesMasteredForTopic(page, 'c4')
  await openingsTopic.goto('c4')
  await expect(openingsTopic.continueLearning()).toBeDisabled()
  await expect(page.getByText('Alle Zugfolgen gemeistert.')).toBeVisible()
})

test('continue-learning opens play with board when lines remain', async ({ openingsTopic, learnPlay, page }) => {
  await openingsTopic.goto('e4')
  await openingsTopic.continueLearning().click()
  await page.waitForURL(/\/learn\/play$/, { waitUntil: SPA_WAIT_UNTIL })
  await expect(page).toHaveURL(/\/learn\/play$/)
  await learnPlay.waitBoard()
  await expect(learnPlay.lineHeading()).toBeVisible()
})
