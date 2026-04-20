import { expect, test, type Page } from '@playwright/test'

const clearStorage = async (page: Page) => {
  await page.addInitScript(() => {
    try {
      if (window.sessionStorage.getItem('__e2e_cleared') !== '1') {
        window.localStorage.clear()
        window.sessionStorage.setItem('__e2e_cleared', '1')
      }
    } catch {
      /* noop */
    }
  })
}

test.beforeEach(async ({ page }) => {
  await clearStorage(page)
})

test('root navigates to /learn and shows the empty state when no selection exists', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/learn$/)
  await expect(
    page.getByRole('heading', { name: 'Noch keine Linie ausgewählt' }),
  ).toBeVisible()
})

test('bottom navigation jumps between Learn, Activity and Openings', async ({ page }) => {
  await page.goto('/learn')
  await page.getByRole('link', { name: 'Eröffnungen' }).click()
  await expect(page).toHaveURL(/\/openings$/)
  await page.getByRole('link', { name: 'Aktivität' }).click()
  await expect(page).toHaveURL(/\/activity$/)
  await page.getByRole('link', { name: 'Lernen' }).click()
  await expect(page).toHaveURL(/\/learn$/)
})

test('openings list shows the five top-level topics', async ({ page }) => {
  await page.goto('/openings')
  await expect(page.getByRole('heading', { name: '1.e4' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '1.d4' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '1.c4' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '1.Nf3' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Other openings' })).toBeVisible()
})

test('clicking a topic opens its overview with progress at 0%', async ({ page }) => {
  await page.goto('/openings')
  await page.getByRole('link', { name: /1\.e4/ }).first().click()
  await expect(page).toHaveURL(/\/openings\/e4$/)

  await expect(page.getByRole('heading', { level: 1, name: '1.e4' })).toBeVisible()
  await expect(page.getByText(/0 \/ \d+ Familien/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Weiter lernen' })).toBeEnabled()
})

test('clicking "Weiter lernen" sets the selection and opens /learn with the board', async ({
  page,
}) => {
  await page.goto('/openings/e4')
  await page.getByRole('button', { name: 'Weiter lernen' }).click()
  await expect(page).toHaveURL(/\/learn$/)

  await expect(page.getByRole('heading', { name: 'Üben' })).toBeVisible()
  await expect(page.locator('cg-board')).toBeVisible()
  await expect(page.locator('text=Aufbau')).toBeVisible()
})

test('drilling a full line via the e2e bridge marks it as mastered', async ({ page }) => {
  await page.goto('/openings/e4')
  await page.getByRole('button', { name: 'Weiter lernen' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.currentLine?.()))

  const line = await page.evaluate(() => window.__chessTheory!.currentLine())
  expect(line).not.toBeNull()

  const sanMoves = await page.evaluate(async () => {
    const res = await fetch('/data/openings/topics/e4.json')
    const e4Topic = (await res.json()) as {
      families: Array<{ lines: Array<{ id: string; sanMoves: string[] }> }>
    }
    const allLines = e4Topic.families.flatMap((f) => f.lines)
    const current = window.__chessTheory!.currentLine()!
    return allLines.find((l) => l.id === current.id)!.sanMoves
  })

  let safety = 0
  while (safety < 1000) {
    safety += 1
    const state = await page.evaluate(() => window.__chessTheory!.state() as {
      phase: string
      expectedMoveIndex: number
      expectedSan: string | null
    } | null)
    if (!state) break
    if (state.phase === 'done') break
    const next = state.expectedSan ?? sanMoves[state.expectedMoveIndex]!
    await page.evaluate(async (san) => {
      await window.__chessTheory!.submit(san)
    }, next)
  }

  await page.waitForFunction(
    () => {
      const s = window.__chessTheory!.state() as { phase: string } | null
      return s?.phase === 'done'
    },
    { timeout: 10_000 },
  )

  const mastered = await page.evaluate(() => window.__chessTheory!.mastered())
  expect(mastered.length).toBeGreaterThan(0)
})

test('the board automatically hints the new move of a fresh step and clears it after the user plays it', async ({
  page,
}) => {
  await page.goto('/openings/e4')
  await page.getByRole('button', { name: 'Weiter lernen' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.currentLine?.()))

  // Wait for the auto-hint to appear at the start of the very first step.
  await page.waitForFunction(() => window.__chessTheory!.hint().active === true)
  expect(await page.evaluate(() => window.__chessTheory!.hint().banner)).toContain('Neuer Zug')

  // Play the expected move; the hint should clear and the step should be marked as demonstrated.
  await page.evaluate(async () => {
    const expected = (window.__chessTheory!.state() as { expectedSan: string }).expectedSan
    await window.__chessTheory!.submit(expected)
  })

  await page.waitForFunction(() => window.__chessTheory!.hint().active === false)
  const hintAfter = await page.evaluate(() => window.__chessTheory!.hint())
  expect(hintAfter.demonstratedSteps).toContain(1)
})

test('the help button is exposed and reveals the next move on demand at session start', async ({
  page,
}) => {
  await page.goto('/openings/e4')
  await page.getByRole('button', { name: 'Weiter lernen' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.currentLine?.()))

  // The Help button is rendered on the page.
  await expect(page.getByRole('button', { name: 'Hilfe' })).toBeVisible()

  // Even if the auto-hint is already active, requesting help is idempotent and
  // continues to return true while there is an expected move on the board.
  const requested = await page.evaluate(() => window.__chessTheory!.requestHelp())
  expect(requested).toBe(true)
  const after = await page.evaluate(() => window.__chessTheory!.hint())
  expect(after.active).toBe(true)
  expect(after.banner).toContain('Hilfe')
})

test('the activity log records session_started + mistake events in localStorage as the user plays', async ({
  page,
}) => {
  await page.goto('/openings/e4')
  await page.getByRole('button', { name: 'Weiter lernen' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.currentLine?.()))

  // Trigger a mistake by submitting an obviously illegal SAN for the position.
  await page.evaluate(async () => {
    await window.__chessTheory!.submit('Zz9')
  })

  const events = await page.evaluate(() => {
    const raw = window.localStorage.getItem('chess-theory:v1:activity')
    if (!raw) return []
    const parsed = JSON.parse(raw) as {
      byLine?: Record<string, Array<{ type: string }>>
    }
    return Object.values(parsed.byLine ?? {}).flat()
  })

  expect(events.some((e) => e.type === 'session_started')).toBe(true)
  expect(events.some((e) => e.type === 'mistake')).toBe(true)
})

test('manually picking a specific line in a family routes to /learn for that line', async ({
  page,
}) => {
  await page.goto('/openings/e4')
  // Open the Italian Game family
  await page.getByRole('button', { name: 'Italian Game' }).click()
  await expect(page).toHaveURL(/\/openings\/e4\/family\/italian-game$/)

  await expect(page.getByRole('heading', { name: 'Italian Game' })).toBeVisible()

  // Click "Üben" on the very first line in the family.
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()

  await expect(page).toHaveURL(/\/learn$/)
  await expect(page.getByRole('heading', { name: 'Üben' })).toBeVisible()
})
