/**
 * PRD: §4.3 Journey C (C1–C9).
 */
import { expect, test } from './fixtures/chess-app.fixture'
import { SPA_WAIT_UNTIL } from './helpers/prd-constants'

test('C1 breadcrumb shows topic and family', async ({ familyTree, page }) => {
  await familyTree.goto('e4', 'italian-game')
  const nav = page.locator('nav').first()
  await expect(nav.getByRole('link', { name: 'e4' })).toBeVisible()
  await expect(nav).toContainText('Italian Game')
})

test('C2 header shows node mastery label', async ({ familyTree, page }) => {
  await familyTree.goto('e4', 'italian-game')
  await page.getByText(/\d+ \/ \d+ Zugfolgen gemeistert/).waitFor({ state: 'visible' })
  await expect(page.getByText(/\d+ \/ \d+ Zugfolgen gemeistert/)).toBeVisible()
})

test('C3 root line card visible for family root', async ({ familyTree, page }) => {
  await familyTree.goto('e4', 'italian-game')
  await expect(page.getByRole('button', { name: 'Jetzt üben' })).toBeVisible()
  await expect(page.locator('p', { hasText: 'Grundposition' }).first()).toBeVisible()
})

test('C4–C7 locked sub-line opens dependency modal', async ({ familyTree, page }) => {
  await familyTree.goto('e4', 'italian-game')
  const row = page.locator('ul > li', { hasText: 'Anti-Fried Liver' }).first()
  await row.getByRole('button', { name: 'Üben' }).click()
  await expect(page.getByRole('heading', { name: 'Grundvariante noch nicht gemeistert' })).toBeVisible()
  await expect(page.getByRole('button', { name: /jetzt üben/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Trotzdem ohne Grundposition üben' })).toBeVisible()
})

test('C8 practice Italian root line reaches play', async ({ familyTree, learnPlay, page }) => {
  await familyTree.goto('e4', 'italian-game')
  await familyTree.practiceFamilyRoot()
  await page.waitForURL(/\/learn\/play$/, { waitUntil: SPA_WAIT_UNTIL })
  await expect(page).toHaveURL(/\/learn\/play$/)
  await learnPlay.waitBoard()
})

test('C9 unknown family shows warning', async ({ page }) => {
  await page.goto('/openings/e4/family/no-such-family-slug-xyz')
  await page.waitForLoadState('load')
  await page.getByText(/Unbekannte Eröffnung/).waitFor({ state: 'visible' })
  await expect(page.getByText(/Unbekannte Eröffnung/)).toBeVisible()
})

test('C9 invalid path segment shows knoten warning', async ({ page }) => {
  await page.goto('/openings/e4/family/italian-game?path=ZZZInvalidPathSegment999')
  await page.waitForLoadState('load')
  await page.getByText('Knoten nicht gefunden').waitFor({ state: 'visible' })
  await expect(page.getByText('Knoten nicht gefunden')).toBeVisible()
})

test('Deep path restores heading for current node', async ({ familyTree, page }) => {
  await familyTree.goto('e4', 'italian-game', 'Classical Variation')
  await page.waitForURL(/path=/, { waitUntil: SPA_WAIT_UNTIL })
  await expect(page).toHaveURL(/path=/)
  await page.getByRole('heading', { name: 'Classical Variation' }).waitFor({ state: 'visible' })
  await expect(page.getByRole('heading', { name: 'Classical Variation' })).toBeVisible()
})
