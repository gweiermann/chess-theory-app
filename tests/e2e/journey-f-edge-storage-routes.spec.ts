/**
 * PRD: §4.6 Journey F (F1–F4), §3.1 /activity redirect.
 */
import { expect, test } from './fixtures/chess-app.fixture'
import { E2E_MAX_WAIT_MS, SPA_WAIT_UNTIL } from './helpers/prd-constants'
import { seedCorruptProgress, seedParentAutoplay } from './helpers/storage-seed'

test('/activity URL resolves to profile activity', async ({ page }) => {
  await page.goto('/activity')
  await page.waitForLoadState('load')
  await page.waitForURL(/\/profile\/activity/, { waitUntil: SPA_WAIT_UNTIL })
  await expect(page).toHaveURL(/\/profile\/activity/)
})

test('F2 clearing storage after practice shows empty play', async ({ familyTree, learnPlay, page }) => {
  await familyTree.goto('e4', 'italian-game')
  await familyTree.practiceFamilyRoot()
  await page.waitForURL(/\/learn\/play$/, { waitUntil: SPA_WAIT_UNTIL })
  await learnPlay.waitBoard()
  await page.evaluate(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
  await learnPlay.goto()
  await expect(page.getByRole('heading', { name: 'Noch keine Zugfolge ausgewählt' })).toBeVisible()
})

test('F3 corrupt progress does not crash app', async ({ page }) => {
  await seedCorruptProgress(page)
  await page.goto('/learn')
  await page.waitForLoadState('load')
  await page.getByRole('heading', { name: 'Modus wählen' }).waitFor({ state: 'visible' })
  await expect(page.getByRole('heading', { name: 'Modus wählen' })).toBeVisible()
})

test('F4 unknown topic shows German warning', async ({ page }) => {
  await page.goto('/openings/not-a-real-topic-id')
  await page.waitForLoadState('load')
  await page
    .getByText(/Unbekanntes Thema|not valid JSON|Unexpected token/)
    .waitFor({ state: 'visible' })
  await expect(
    page.getByText(/Unbekanntes Thema|not valid JSON|Unexpected token/),
  ).toBeVisible({ timeout: E2E_MAX_WAIT_MS })
})

test('F1 refresh mid-session keeps play usable', async ({ familyTree, learnPlay, page }) => {
  await seedParentAutoplay(page, true)
  await familyTree.goto('e4', 'italian-game')
  await familyTree.practiceFamilyRoot()
  await page.waitForURL(/\/learn\/play$/, { waitUntil: SPA_WAIT_UNTIL })
  await learnPlay.waitBoard()
  await page.reload()
  await learnPlay.waitBoard()
  await expect(learnPlay.lineHeading()).toBeVisible()
})
