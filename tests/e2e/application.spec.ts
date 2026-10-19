import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { Chess } from 'chess.js'

const longestItalian = [
  'e4',
  'e5',
  'Nf3',
  'Nc6',
  'Bc4',
  'Bc5',
  'c3',
  'Nf6',
  'd4',
  'exd4',
  'cxd4',
  'Bb4+',
  'Nc3',
  'Nxe4',
  'O-O',
  'Bxc3',
  'd5',
  'Bf6',
  'Re1',
  'Ne7',
  'Rxe4',
  'd6',
  'Bg5',
  'Bxg5',
  'Nxg5',
  'O-O',
  'Nxh7',
]

async function playLongestItalian(page: Page) {
  const game = new Chess()
  for (const san of longestItalian) {
    const learnerTurn = game.turn() === 'w'
    const played = game.move(san)
    if (learnerTurn) await move(page, played.from, played.to)
    else await page.clock.runFor(900)
  }
}

async function configure(page: Page, side = 'white', repetitions = '1') {
  await page.goto('/profile')
  await page.getByLabel('Bevorzugte Seite').selectOption(side)
  await page.getByLabel('Sichere Wiederholungen').fill(repetitions)
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click()
  await expect(
    page.getByText('Einstellungen gespeichert.', { exact: true }),
  ).toBeVisible()
}
async function italian(page: Page, mode = 'Lernen') {
  await page.goto('/openings')
  await page
    .getByLabel('Variante oder Zugfolge suchen')
    .fill('Anti-Fried Liver')
  await page
    .getByRole('button', {
      name: `${mode}: Italian Game: Anti-Fried Liver Defense`,
      exact: true,
    })
    .click()
  await expect(page.getByTestId('square-e2')).toBeVisible()
}
async function move(page: Page, from: string, to: string) {
  await page.getByRole('button', { name: new RegExp(`^${from} `) }).click()
  await page.getByRole('button', { name: new RegExp(`^${to} `) }).click()
}
async function gameLayout(page: Page) {
  return Promise.all(
    ['.board-grid', '.history-controls', '.actions', '.training-header h1'].map(
      (selector) => page.locator(selector).boundingBox(),
    ),
  )
}

async function playItalianBase(page: Page) {
  await move(page, 'e2', 'e4')
  await expect(page.getByTestId('square-e5')).toHaveAttribute('data-piece', 'p')
  await move(page, 'g1', 'f3')
  await expect(page.getByTestId('square-c6')).toHaveAttribute('data-piece', 'n')
  await move(page, 'f1', 'c4')
}

test('cold page contains a loading shell and the full app becomes usable', async ({
  page,
  request,
}) => {
  const html = await request.get('/')
  expect(await html.text()).toContain('Dein Schachbrett wird vorbereitet')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(
    page.getByRole('navigation', { name: 'Hauptnavigation' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Italienisch spielen →' }),
  ).toBeEnabled()
  expect(errors).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('new learning follows complete Italian leaves and selects the deepest sibling next', async ({
  page,
}) => {
  test.setTimeout(60000)
  await configure(page)
  await page.goto('/openings')
  await expect(
    page.getByRole('heading', { name: 'Italienisch', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.line-card')).toHaveCount(114)
  await expect(page.getByTestId('line-C50-9be1bdf94f6d382ed8f5')).toHaveCount(0)
  await page.getByRole('button', { name: 'Nächste Variante lernen' }).click()
  await expect(page).toHaveURL(/line=C54-052bf93dbba66694a081/)
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await playLongestItalian(page)
  await expect(page.getByTestId('training-phase')).toHaveText(
    'Aus dem Gedächtnis',
  )
  await page.clock.runFor(650)
  await expect(page.getByTestId('square-e2')).toHaveAttribute('data-piece', 'p')
  await playLongestItalian(page)
  await expect(page.getByTestId('round-complete')).toContainText('gemeistert')
  await page.clock.resume()
  await page.getByRole('button', { name: 'Nächste Runde →' }).click()
  await expect(page).toHaveURL(/line=C54-f4f02af37ea66cd54264/)
})

test('learn a line with real board clicks, earn mastery, and retain it after reload', async ({
  page,
}) => {
  await configure(page)
  await italian(page)
  // Wider fallback-font metrics must not resize the header at completion.
  await page.addStyleTag({
    content:
      '.training-layout .training-header .phase-label { font-family: monospace; font-size: 14px; }',
  })
  await expect(page.getByTestId('training-phase')).toHaveText(
    'Geführt aufbauen',
  )
  await playItalianBase(page)
  await expect(page.getByTestId('training-phase')).toHaveText(
    'Aus dem Gedächtnis',
  )
  await expect(page.getByTestId('square-e2')).toHaveAttribute('data-piece', 'p')
  await expect(page.getByTestId('square-e4')).not.toHaveAttribute(
    'data-piece',
    'p',
  )
  const beforeCompletion = await gameLayout(page)
  await playItalianBase(page)
  await expect(page.getByTestId('round-complete')).toContainText('gemeistert')
  expect(await gameLayout(page)).toEqual(beforeCompletion)
  await page.getByRole('link', { name: 'Verlassen' }).click()
  await expect(page.locator('.home-footer')).toHaveCount(0)
  await page.goto('/profile')
  const whiteProgress = page
    .locator('.counts p')
    .filter({ hasText: 'Gelernte Varianten mit Weiß' })
  await expect(whiteProgress).toContainText('1')
  await page.reload()
  await expect(whiteProgress).toContainText('1')
})

test('a rejected attempt does not change the board and the second try shows a solution', async ({
  page,
}) => {
  await configure(page)
  await italian(page, 'Wiederholen')
  await move(page, 'a2', 'a3')
  await expect(page.getByText(/zweiten Versuch/)).toBeVisible()
  await expect(page.getByTestId('square-a2')).toHaveAttribute('data-piece', 'p')
  await move(page, 'a2', 'a3')
  await expect(page.getByText(/blaue Pfeil zeigt/)).toBeVisible()
  await expect(page.locator('svg [data-purpose="solution"]')).toBeVisible()
  await move(page, 'e2', 'e4')
  await expect(page.getByTestId('square-e5')).toHaveAttribute('data-piece', 'p')
})

test('Black-side training auto-plays White and restores a saved round', async ({
  page,
}) => {
  await configure(page, 'black')
  await italian(page)
  await expect(page.getByTestId('square-e4')).toHaveAttribute('data-piece', 'p')
  await move(page, 'e7', 'e5')
  await expect(page.getByTestId('square-f3')).toHaveAttribute('data-piece', 'n')
  await page.getByRole('link', { name: 'Verlassen' }).click()
  await page.getByRole('button', { name: /letzte Runde fortsetzen/i }).click()
  await expect(page.getByTestId('square-e5')).toHaveAttribute('data-piece', 'p')
  await expect(page.getByTestId('square-f3')).toHaveAttribute('data-piece', 'n')
  await expect(
    page.getByText('Du spielst Schwarz', { exact: false }),
  ).toBeVisible()
})

test('history inspection is read-only and restart cancels the old opponent reply', async ({
  page,
}) => {
  await configure(page)
  await italian(page, 'Wiederholen')
  await move(page, 'e2', 'e4')
  await page.getByRole('button', { name: 'Neu starten' }).click()
  await expect(page.getByTestId('square-e2')).toHaveAttribute('data-piece', 'p')
  await expect(page.getByTestId('square-e7')).toHaveAttribute('data-piece', 'p')
  await move(page, 'e2', 'e4')
  await expect(page.getByTestId('square-e5')).toHaveAttribute('data-piece', 'p')
  const beforeHistory = await gameLayout(page)
  await page.getByRole('button', { name: 'Vorheriger Zug' }).click()
  await expect(page.getByText(/Zugansicht/)).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Hilfe anzeigen' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Live', exact: true }),
  ).toHaveCount(0)
  expect(await gameLayout(page)).toEqual(beforeHistory)
  await page.getByRole('button', { name: 'Nächster Zug' }).click()
  expect(await gameLayout(page)).toEqual(beforeHistory)
  await expect(page.getByTestId('square-e5')).toHaveAttribute('data-piece', 'p')
})

test('sparring accepts alternate continuations and presents optional suggestions', async ({
  page,
}) => {
  await configure(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Italienisch spielen →' }).click()
  await expect(page.getByTestId('square-c6')).toHaveAttribute('data-piece', 'n')
  await expect(
    page.getByRole('button', { name: 'Anderen Weg zeigen' }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Anderen Weg zeigen' }).click()
  await expect(page.locator('svg [data-purpose="exploration"]')).toBeVisible()
  // Both Bc4 and d4 are real Italian-source continuations at this position.
  await move(page, 'd2', 'd4')
  await expect(page.getByTestId('square-d2')).not.toHaveAttribute(
    'data-piece',
    'p',
  )
  await expect(page.getByText(/zweiten Versuch/)).toHaveCount(0)
})

test('unknown source references show recovery controls instead of a blank screen', async ({
  page,
}) => {
  await page.goto('/learn/play?family=missing&line=missing')
  await expect(page.getByRole('alert')).toContainText('nicht mehr verfügbar')
  await expect(page.getByRole('link', { name: 'Zur Bibliothek' })).toBeVisible()
})
