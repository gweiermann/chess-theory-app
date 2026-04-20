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
    page.getByRole('heading', { name: 'Noch keine Zugfolge ausgewählt' }),
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
  await expect(page.getByRole('heading', { name: 'e4', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'd4', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'c4', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nf3', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Andere Eröffnungen' })).toBeVisible()
})

test('clicking a topic opens its overview with progress at 0%', async ({ page }) => {
  await page.goto('/openings')
  await page.locator('a[href="/openings/e4"]').first().click()
  await expect(page).toHaveURL(/\/openings\/e4$/)

  await expect(
    page.getByRole('heading', { level: 1, name: 'e4', exact: true }),
  ).toBeVisible()
  await expect(page.getByText(/0 \/ \d+ Eröffnungen/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Weiter lernen' })).toBeEnabled()
})

test('openings topic page groups families into Eröffnungen, Verteidigungen and Gambits', async ({
  page,
}) => {
  await page.goto('/openings/e4')
  // Each section renders only when it has content. For e4 all three buckets
  // are guaranteed to have at least one family, so asserting visibility is
  // the tightest way to lock in the grouping.
  await expect(page.locator('[data-section="opening"]')).toBeVisible()
  await expect(page.locator('[data-section="defense"]')).toBeVisible()
  await expect(page.locator('[data-section="gambit"]')).toBeVisible()
})

test('the openings topic page exposes a search that filters families in place', async ({
  page,
}) => {
  await page.goto('/openings/e4')
  // Unfiltered state: a known defense and a known opening are both visible.
  await expect(page.getByRole('button', { name: 'Italian Game' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Alekhine Defense' })).toBeVisible()

  await page.getByTestId('openings-search').fill('alekhine')
  await expect(page.getByRole('button', { name: 'Alekhine Defense' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Italian Game' })).toHaveCount(0)
})

test('clicking "Weiter lernen" sets the selection and opens /learn with the board', async ({
  page,
}) => {
  await page.goto('/openings/e4')
  await page.getByRole('button', { name: 'Weiter lernen' }).click()
  await expect(page).toHaveURL(/\/learn$/)

  // The learn page now uses the current line's full name as its h1 instead
  // of the stand-alone "Üben" label, so assert on the mounted chess board
  // and the session HUD's phase text instead.
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

test('auto-hint re-arms with the NEW expected move after the opponent replies on a fresh step', async ({
  page,
}) => {
  // Pin the test to the Italian Game so the sequence is deterministic:
  //   1. e4  e5   2. Nf3  Nc6   3. Bc4
  // With three user-side steps we can exercise the "after the opponent replies
  // on step 2, the hint must point at Nf3, not still at e4" path.
  await page.goto('/openings/e4/family/italian-game')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.currentLine?.()))

  await page.waitForFunction(() => {
    const line = window.__chessTheory!.currentLine() as { id: string } | null
    return !!line && line.id.includes('italian-game')
  })

  // At the very first step the auto-hint points at the first user move and the
  // banner includes the SAN so it is actionable on small screens.
  await page.waitForFunction(() => window.__chessTheory!.hint().active === true)
  const firstSan = await page.evaluate(
    () => (window.__chessTheory!.state() as { expectedSan: string }).expectedSan,
  )
  expect(firstSan).toBe('e4')
  const firstBanner = await page.evaluate(() => window.__chessTheory!.hint().banner)
  expect(firstBanner).toBe(`Neuer Zug – probiere ihn aus: ${firstSan}`)

  // Finish step 1 so the session moves to step 2, then replay the first move.
  // After the opponent auto-replies, the hint banner MUST advance to the NEW
  // expected move (Nf3), never stay on the previous one (e4).
  await page.evaluate(async () => {
    await window.__chessTheory!.submit('e4')
  })
  await page.waitForFunction(() => {
    const s = window.__chessTheory!.state() as {
      currentStep: number
      expectedMoveIndex: number
    } | null
    return !!s && s.currentStep === 2 && s.expectedMoveIndex === 0
  })
  await page.evaluate(async () => {
    await window.__chessTheory!.submit('e4')
  })

  await page.waitForFunction(() => {
    const s = window.__chessTheory!.state() as {
      expectedMoveIndex: number
      currentStep: number
      expectedSan: string | null
    } | null
    return !!s && s.currentStep === 2 && s.expectedMoveIndex === 2 && s.expectedSan === 'Nf3'
  })

  await page.waitForFunction(() => window.__chessTheory!.hint().active === true)
  const newBanner = await page.evaluate(() => window.__chessTheory!.hint().banner)
  expect(newBanner).toBe('Neuer Zug – probiere ihn aus: Nf3')
})

test('a one-step line (Alekhine Defense, 1.e4 Nf6) drives from the opponent-first build step through every repetition to done', async ({
  page,
}) => {
  // Alekhine has sanMoves=['e4','Nf6'] and userSide='black' (defenses are
  // played from black's perspective so white opens and the user answers).
  // There is exactly ONE user-side step (Nf6). The opponent's ...e4 is
  // auto-played on startLine so the hint banner arms with the user's first
  // move directly. After Nf6, the session transitions building → repeating
  // and the full rep loop must run cleanly to phase=done with the target
  // rep count – regressions in the reset-after-opponent or "Accepted"
  // family-merge logic would hang or mis-route the first rep move.
  await page.goto('/openings/e4/family/alekhine-defense')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.currentLine?.()))

  await page.waitForFunction(() => {
    const line = window.__chessTheory!.currentLine() as { id: string } | null
    return !!line && line.id === 'B02-alekhine-defense'
  })

  await page.waitForFunction(() => window.__chessTheory!.hint().active === true)
  const initial = await page.evaluate(() => window.__chessTheory!.hint().banner)
  expect(initial).toBe('Neuer Zug – probiere ihn aus: Nf6')

  // Finish step 1 (Nf6). The session must now be in the repeating phase
  // waiting for the opponent's ...e4 again from the INITIAL position – which
  // the app plays itself, leaving the user back on Nf6 for rep #1.
  await page.evaluate(async () => {
    await window.__chessTheory!.submit('Nf6')
  })

  await page.waitForFunction(() => {
    const s = window.__chessTheory!.state() as {
      phase: string
      expectedMoveIndex: number
    } | null
    return !!s && s.phase === 'repeating' && s.expectedMoveIndex === 0
  })

  let safety = 0
  while (safety < 200) {
    safety += 1
    const state = await page.evaluate(() => window.__chessTheory!.state() as {
      phase: string
      expectedSan: string | null
    } | null)
    if (!state) break
    if (state.phase === 'done') break
    const next = state.expectedSan
    if (!next) break
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

  // Let the auto-hint settle first so the subsequent requestHelp() reliably
  // replaces the banner instead of racing with the initial showHintIfNewStep()
  // that startLine() schedules on mount.
  await page.waitForFunction(() => {
    const h = window.__chessTheory!.hint()
    return h.active === true && typeof h.banner === 'string' && h.banner.startsWith('Neuer Zug')
  })

  // Even if the auto-hint is already active, requesting help is idempotent and
  // continues to return true while there is an expected move on the board.
  const requested = await page.evaluate(() => window.__chessTheory!.requestHelp())
  expect(requested).toBe(true)
  await page.waitForFunction(() => {
    const h = window.__chessTheory!.hint()
    return h.active === true && typeof h.banner === 'string' && h.banner.startsWith('Hilfe')
  })
  const after = await page.evaluate(() => window.__chessTheory!.hint())
  expect(after.active).toBe(true)
  expect(after.banner).toContain('Hilfe')
  const expectedSan = await page.evaluate(
    () => (window.__chessTheory!.state() as { expectedSan: string }).expectedSan,
  )
  expect(after.banner).toBe(`Hilfe – nächster Zug: ${expectedSan}`)
})

test('the chessboard stays at a stable viewport position whether or not the hint banner is visible (click-offset regression)', async ({
  page,
}) => {
  // When a sibling above the board (the hint banner) toggles its presence in
  // the DOM flow, chessground's cached board rect goes stale and every click
  // lands on a square offset by the banner's height until the next window
  // resize. The page now reserves a fixed slot for the banner so the board
  // never moves. This test pins that contract: the board's bounding rect at
  // both desktop AND mobile must be identical whether the banner is active
  // (auto-hint after start / Help requested) or inactive (after submitting
  // the expected move, before the next hint arms).
  const measureBoard = async () => {
    return await page.evaluate(() => {
      const el = document.querySelector('.chessboard-shell') as HTMLElement | null
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: r.top, left: r.left, width: r.width, height: r.height }
    })
  }

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/openings/e4/family/italian-game')
    const firstRow = page.locator('ul > li').first()
    await firstRow.getByRole('button', { name: 'Üben' }).click()
    await page.waitForURL(/\/learn$/)
    await page.goto('/learn?e2e=1')
    await page.waitForFunction(() => Boolean(window.__chessTheory?.currentLine?.()))

    // Initial auto-hint: banner active.
    await page.waitForFunction(() => window.__chessTheory!.hint().active === true)
    const withBanner = await measureBoard()
    expect(withBanner).not.toBeNull()

    // Submit the expected move; the hint clears, and for a brief window no
    // banner is drawn before the next step's auto-hint arms. During that
    // window the board must NOT have shifted vertically.
    await page.evaluate(async () => {
      const expected = (window.__chessTheory!.state() as { expectedSan: string }).expectedSan
      await window.__chessTheory!.submit(expected)
    })
    await page.waitForFunction(() => window.__chessTheory!.hint().active === false)
    const withoutBanner = await measureBoard()

    expect(withoutBanner).not.toBeNull()
    expect(withoutBanner!.top).toBeCloseTo(withBanner!.top, 0)
    expect(withoutBanner!.left).toBeCloseTo(withBanner!.left, 0)
    expect(withoutBanner!.width).toBeCloseTo(withBanner!.width, 0)
    expect(withoutBanner!.height).toBeCloseTo(withBanner!.height, 0)
  }
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

test('a wrong move flashes a red mistake banner that auto-clears', async ({ page }) => {
  // The banner uses DOM + a typed kind accessible via the e2e bridge, so we
  // assert both the bridge-level `bannerKind` contract AND that a visibly
  // distinct red element is rendered at the top of the board area.
  await page.goto('/openings/e4/family/italian-game')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.currentLine?.()))
  await page.waitForFunction(() => window.__chessTheory!.hint().active === true)

  await page.evaluate(async () => {
    await window.__chessTheory!.submit('Zz9')
  })

  await page.waitForFunction(() => window.__chessTheory!.hint().bannerKind === 'mistake')
  const mistake = await page.evaluate(() => window.__chessTheory!.hint())
  expect(mistake.banner).toBe('Falscher Zug – nochmal versuchen')
  expect(mistake.bannerKind).toBe('mistake')
  await expect(page.locator('[data-banner-kind="mistake"]')).toBeVisible()
})

test('advancing to the next building step shows a blue memory banner above the board', async ({
  page,
}) => {
  // Italian Game has 3 user-side steps (e4, Nf3, Bc4). After completing step 1
  // the board resets and the user is expected to replay previously learned
  // moves before the next new-step hint arms. That "from memory" moment gets
  // its own blue banner so the user understands why the board was cleared.
  await page.goto('/openings/e4/family/italian-game')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.currentLine?.()))

  await page.waitForFunction(() => {
    const line = window.__chessTheory!.currentLine() as { id: string } | null
    return !!line && line.id.includes('italian-game')
  })
  await page.waitForFunction(() => window.__chessTheory!.hint().active === true)

  await page.evaluate(async () => {
    await window.__chessTheory!.submit('e4')
  })

  await page.waitForFunction(() => window.__chessTheory!.hint().bannerKind === 'memory')
  const memory = await page.evaluate(() => window.__chessTheory!.hint())
  expect(memory.bannerKind).toBe('memory')
  expect(memory.banner).toBe('Spiele 1 Zug aus dem Gedächtnis')
  await expect(page.locator('[data-banner-kind="memory"]')).toBeVisible()
})

test('finishing the building phase shows a green setup-complete banner before the repetitions', async ({
  page,
}) => {
  // Alekhine (defense, user plays black) has exactly one user-side step so
  // the very first correctly played move takes the session straight from
  // building → repeating. The transition must be announced with a
  // celebratory banner.
  await page.goto('/openings/e4/family/alekhine-defense')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.currentLine?.()))
  await page.waitForFunction(() => window.__chessTheory!.hint().active === true)

  await page.evaluate(async () => {
    await window.__chessTheory!.submit('Nf6')
  })

  await page.waitForFunction(() => window.__chessTheory!.hint().bannerKind === 'setup-complete')
  const setup = await page.evaluate(() => window.__chessTheory!.hint())
  expect(setup.bannerKind).toBe('setup-complete')
  expect(setup.banner).toContain('Aufbau geschafft')
  await expect(page.locator('[data-banner-kind="setup-complete"]')).toBeVisible()
})

test('the halfway repetition is announced with a green motivation banner', async ({ page }) => {
  // Drive the Alekhine line (1.e4 Nf6) through its repetition loop and
  // assert that at the exact moment the rep counter crosses halfway we
  // surface a motivational banner so the user feels progress. The memory
  // banner is the default for subsequent reps; halfway is the single
  // deviation.
  await page.goto('/openings/e4/family/alekhine-defense')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.currentLine?.()))
  await page.waitForFunction(() => window.__chessTheory!.hint().active === true)

  // Read TARGET_REPS by fetching it from the runtime via the halfway banner
  // text format ("Halbzeit – weiter so! (X/Y)") would be circular; instead
  // we drive reps until the motivation kind appears, with a generous cap.
  await page.evaluate(async () => {
    await window.__chessTheory!.submit('Nf6')
  })
  await page.waitForFunction(() => {
    const s = window.__chessTheory!.state() as { phase: string; repsDone: number } | null
    return s?.phase === 'repeating' && s.repsDone === 0
  })

  let safety = 0
  while (safety < 60) {
    safety += 1
    const h = await page.evaluate(() => window.__chessTheory!.hint())
    if (h.bannerKind === 'motivation') break
    const s = await page.evaluate(() => window.__chessTheory!.state() as {
      phase: string
      expectedSan: string | null
    } | null)
    if (!s || s.phase === 'done') break
    const next = s.expectedSan
    if (!next) break
    await page.evaluate(async (san) => {
      await window.__chessTheory!.submit(san)
    }, next)
  }

  const motivation = await page.evaluate(() => window.__chessTheory!.hint())
  expect(motivation.bannerKind).toBe('motivation')
  expect(motivation.banner).toContain('Halbzeit')
  await expect(page.locator('[data-banner-kind="motivation"]')).toBeVisible()
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
  // The h1 now carries the selected line's full name rather than a stand
  // alone "Üben" label, so we assert on the mounted board instead.
  await expect(page.locator('cg-board')).toBeVisible()
})
