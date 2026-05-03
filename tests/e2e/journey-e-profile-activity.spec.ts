/**
 * PRD: §4.5 Journey E (E1–E5).
 */
import { expect, test } from './fixtures/chess-app.fixture'
import { E2E_MAX_WAIT_MS, SPA_WAIT_UNTIL } from './helpers/prd-constants'
import { seedActivityGhostLine, seedParentAutoplay } from './helpers/storage-seed'
import { initItalianAutoplayGame, playSanFromUi } from './helpers/session-driver'

/** Skipped: learn/play no longer has `[data-banner-kind]`; these tests use `playSanFromUi` / banner locators. Re-enable when e2e can drive play without that strip. */

test('E1 profile shows activity section', async ({ profile, page }) => {
  await profile.goto()
  await expect(page.getByRole('heading', { name: 'Aktivität' })).toBeVisible()
})

test('E2 toggle persists across reload', async ({ profile, page }) => {
  await profile.goto()
  await profile.parentAutoplayToggle().click()
  await expect(profile.parentAutoplayToggle()).toContainText('Aktiv')
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('chess-theory:v1:profile-settings')
        return raw?.includes('"autoPlayParentPrefix":true') ?? false
      }),
    )
    .toBe(true)
  await page.reload()
  await expect(profile.parentAutoplayToggle()).toContainText('Aktiv')
})

test.skip('E4 resume practice routes to /learn', async ({ familyTree, learnPlay, activity, page }) => {
  await seedParentAutoplay(page, true)
  await familyTree.goto('e4', 'italian-game')
  await familyTree.practiceFamilyRoot()
  await page.waitForURL(/\/learn\/play$/, { waitUntil: SPA_WAIT_UNTIL })
  await learnPlay.waitBoard()
  const g = initItalianAutoplayGame()
  await playSanFromUi(page, learnPlay, g)
  await page.getByTestId('play-back-button').click()
  await activity.goto()
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/, { waitUntil: SPA_WAIT_UNTIL })
  await expect(page).toHaveURL(/\/learn$/)
})

test('E5 ghost line shows unavailable copy', async ({ activity, page }) => {
  await seedActivityGhostLine(page)
  await activity.goto()
  await page.getByText('Zugfolge nicht mehr verfügbar').waitFor({ state: 'visible' })
  await expect(page.getByText('Zugfolge nicht mehr verfügbar')).toBeVisible()
  await expect(page.locator('ul > li').first().getByRole('button', { name: 'Üben' })).toBeDisabled()
})

test.skip('E3 activity list shows stats row', async ({ familyTree, learnPlay, activity, page }) => {
  await seedParentAutoplay(page, true)
  await familyTree.goto('e4', 'italian-game')
  await familyTree.practiceFamilyRoot()
  await page.waitForURL(/\/learn\/play$/, { waitUntil: SPA_WAIT_UNTIL })
  await learnPlay.waitBoard()
  const g = initItalianAutoplayGame()
  await playSanFromUi(page, learnPlay, g)
  await page.getByTestId('play-back-button').click()
  await activity.goto()
  await expect(page.getByText('Wdh.')).toBeVisible()
})

test.skip('autoplay from profile reaches play with hint', async ({ profile, familyTree, learnPlay, page }) => {
  await profile.goto()
  await profile.parentAutoplayToggle().click()
  await familyTree.goto('e4', 'italian-game')
  await familyTree.practiceFamilyRoot()
  await page.waitForURL(/\/learn\/play$/, { waitUntil: SPA_WAIT_UNTIL })
  await learnPlay.waitBoard()
  await expect(learnPlay.banner('hint')).toBeVisible({ timeout: E2E_MAX_WAIT_MS })
})
