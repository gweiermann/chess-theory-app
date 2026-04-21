import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __chessTheory?: {
      currentLine: () => unknown
      state: () => unknown
      hint: () => {
        active: boolean
        banner: string | null
        bannerKind: string | null
        demonstratedSteps: number[]
      }
      submit: (san: string) => Promise<unknown>
      requestHelp: () => boolean
      mastered: () => string[]
    }
  }
}

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

const seedMasteredLine = async (
  page: Page,
  topicId: string,
  lineId: string,
) => {
  await page.addInitScript(([seedTopicIdRaw, seedLineIdRaw]) => {
    try {
      const seedTopicId = typeof seedTopicIdRaw === 'string' ? seedTopicIdRaw : ''
      const seedLineId = typeof seedLineIdRaw === 'string' ? seedLineIdRaw : ''
      if (!seedTopicId || !seedLineId) return
      const key = 'chess-theory:v1:progress'
      const now = Date.now()
      const existingRaw = window.localStorage.getItem(key)
      const existing = existingRaw
        ? JSON.parse(existingRaw) as { version?: number; byTopic?: Record<string, Record<string, unknown>> }
        : {}
      const byTopic = existing.byTopic ?? {}
      const topicEntries = byTopic[seedTopicId] ?? {}
      topicEntries[seedLineId] = {
        lineId: seedLineId,
        status: 'mastered',
        reps: 5,
        lastPracticedAt: now,
      }
      byTopic[seedTopicId] = topicEntries
      window.localStorage.setItem(key, JSON.stringify({ version: 1, byTopic }))
    } catch {
      /* noop */
    }
  }, [topicId, lineId])
}

const setParentAutoplay = async (
  page: Page,
  enabled: boolean,
) => {
  await page.addInitScript(([isEnabledRaw]) => {
    try {
      const isEnabled = Boolean(isEnabledRaw)
      const key = 'chess-theory:v1:profile-settings'
      window.localStorage.setItem(
        key,
        JSON.stringify({ autoPlayParentPrefix: isEnabled }),
      )
    } catch {
      /* noop */
    }
  }, [enabled])
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

test('bottom navigation jumps between Learn, Openings and Profile', async ({ page }) => {
  await page.goto('/learn')
  await page.getByRole('link', { name: 'Eröffnungen' }).click()
  await expect(page).toHaveURL(/\/openings$/)
  await page.getByRole('link', { name: 'Profil' }).click()
  await expect(page).toHaveURL(/\/profile$/)
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
  // and the learn heading presence instead. (The session phase text lives
  // inside the Info modal now so we don't assert on it here.)
  await expect(page.locator('cg-board')).toBeVisible()
  await expect(page.getByTestId('learn-line-heading')).toBeVisible()
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
    const current = window.__chessTheory!.currentLine() as { id: string }
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
  // With the default (autoPlayParentPrefix=false) the user is FIRST asked
  // to play the parent prefix manually and no step hint is drawn while the
  // intro phase is running. Enable autoplay so the session starts in
  // building phase where the "Neuer Zug" auto-hint is expected.
  await setParentAutoplay(page, true)
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
  await setParentAutoplay(page, true)
  // Pin the test to the Italian Game so the sequence is deterministic:
  //   1. e4  e5   2. Nf3  Nc6   3. Bc4
  // The topic's first move (e4) is considered implicitly learned – it is
  // auto-played as a prefix rather than drilled – so the first user-side
  // step is Nf3 and step 2 is Bc4. After completing step 1 the board resets
  // to the prefix position, the opponent auto-replies with Nc6, and the
  // hint banner MUST advance to the NEW expected move (Bc4), never stay
  // on the previous one (Nf3).
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
  expect(firstSan).toBe('Nf3')
  const firstBanner = await page.evaluate(() => window.__chessTheory!.hint().banner)
  expect(firstBanner).toBe(`Neuer Zug – probiere ihn aus: ${firstSan}`)

  // Finish step 1 (Nf3). The session resets to the prefix position (after
  // e4, auto-played) and waits for the opponent to play e5. After the user
  // replays Nf3 from memory the opponent auto-plays Nc6, and the hint must
  // now point at the NEW expected move (Bc4).
  await page.evaluate(async () => {
    await window.__chessTheory!.submit('Nf3')
  })
  await page.waitForFunction(() => {
    const s = window.__chessTheory!.state() as {
      currentStep: number
      expectedMoveIndex: number
    } | null
    return !!s && s.currentStep === 2 && s.expectedMoveIndex === 1
  })
  await page.evaluate(async () => {
    await window.__chessTheory!.submit('e5')
    await window.__chessTheory!.submit('Nf3')
  })

  await page.waitForFunction(() => {
    const s = window.__chessTheory!.state() as {
      expectedMoveIndex: number
      currentStep: number
      expectedSan: string | null
    } | null
    return !!s && s.currentStep === 2 && s.expectedMoveIndex === 4 && s.expectedSan === 'Bc4'
  })

  await page.waitForFunction(() => window.__chessTheory!.hint().active === true)
  const newBanner = await page.evaluate(() => window.__chessTheory!.hint().banner)
  expect(newBanner).toBe('Neuer Zug – probiere ihn aus: Bc4')
})

test('a one-step line (Alekhine Defense, 1.e4 Nf6) drives from the opponent-first build step through every repetition to done', async ({
  page,
}) => {
  // Alekhine has sanMoves=['e4','Nf6'] and userSide='black' (defenses are
  // played from black's perspective so white opens and the user answers).
  // The topic's first move (e4) is treated as an implicit prefix (auto-
  // played on startLine AND on every reset), so there is exactly ONE
  // user-side step (Nf6). After Nf6, the session transitions
  // building → repeating with expectedMoveIndex back at the prefix; the
  // full rep loop must run cleanly to phase=done with the target rep
  // count – regressions in the reset-after-opponent or "Accepted"
  // family-merge logic would hang or mis-route the first rep move.
  await setParentAutoplay(page, true)
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
  // waiting from the prefix position (after white's e4, auto-played on
  // reset). That leaves expectedMoveIndex at prefixPlies=1 waiting for the
  // user's Nf6 for rep #1.
  await page.evaluate(async () => {
    await window.__chessTheory!.submit('Nf6')
  })

  await page.waitForFunction(() => {
    const s = window.__chessTheory!.state() as {
      phase: string
      expectedMoveIndex: number
    } | null
    return !!s && s.phase === 'repeating' && s.expectedMoveIndex === 1
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
  await setParentAutoplay(page, true)
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

test('learn header shows the current line name and bottom controls stay icon-only', async ({
  page,
}) => {
  await page.goto('/openings/e4/family/italian-game')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.waitForSelector('cg-board')

  const lineName = await page.evaluate(() => {
    const heading = document.querySelector('.learn-layout > div.min-w-0 > p')
    return heading?.textContent?.trim() ?? ''
  })
  expect(lineName.length).toBeGreaterThan(0)
  await expect(page.locator('.learn-layout > div.min-w-0 > p')).toContainText(lineName)
  await expect(
    page.locator('div.fixed.inset-x-0.bottom-\\[4\\.25rem\\]').getByText(lineName, { exact: true }),
  ).toHaveCount(0)
})

test('three-dot actions open as modal sheet (not board-overlapping popover)', async ({
  page,
}) => {
  await page.goto('/openings/e4/family/italian-game')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.waitForSelector('cg-board')

  await page.getByRole('button', { name: 'Mehr' }).click()
  await expect(page.getByRole('heading', { name: 'Aktionen' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Vorherige Folge' })).toBeVisible()
  const hasLegacyPopover = await page.evaluate(() =>
    Array.from(document.querySelectorAll('div'))
      .some((el) => (el.className || '').includes('bottom-[calc(100%+0.5rem)]')))
  expect(hasLegacyPopover).toBe(false)
})

test('intro banner keeps board position stable and renders "Hab ich vergessen" inline', async ({
  page,
}) => {
  // Default is autoplay=off, which means the intro phase runs and the
  // user is prompted to play the parent by hand. Master the short
  // Alekhine parent so the child line's intro can reference it by name.
  await seedMasteredLine(page, 'e4', 'B02-alekhine-defense')

  await page.goto('/openings/e4/family/alekhine-defense')
  const brooklynRow = page.locator('ul > li', { hasText: 'Brooklyn Variation' }).first()
  await brooklynRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.waitForSelector('cg-board')

  const measureBoard = async () => {
    return await page.evaluate(() => {
      const el = document.querySelector('.chessboard-shell') as HTMLElement | null
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: r.top, left: r.left, width: r.width, height: r.height }
    })
  }

  await expect(page.locator('[data-banner-kind="memory"]')).toBeVisible()
  await expect(page.locator('[data-banner-kind="memory"]')).toContainText('Hab ich vergessen')
  const introRect = await measureBoard()
  expect(introRect).not.toBeNull()

  // Complete intro plies quickly and ensure board anchor stays stable.
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.state?.()))
  for (const san of ['e4', 'Nf6']) {
    await page.evaluate(async (move) => {
      await window.__chessTheory!.submit(move)
    }, san)
  }

  const afterIntroRect = await measureBoard()
  expect(afterIntroRect).not.toBeNull()
  expect(afterIntroRect!.top).toBeCloseTo(introRect!.top, 0)
  expect(afterIntroRect!.left).toBeCloseTo(introRect!.left, 0)
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
  await setParentAutoplay(page, true)
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
  await setParentAutoplay(page, true)
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
  await setParentAutoplay(page, true)
  // Italian Game has 3 user-side moves (e4, Nf3, Bc4). With the topic's
  // first move (e4) auto-played as an implicit prefix, the user's
  // drillable steps are Nf3 (step 1) and Bc4 (step 2). After completing
  // step 1 the board resets to the prefix position and the user is
  // expected to replay previously learned moves before the next
  // new-step hint arms. That "from memory" moment gets its own blue
  // banner so the user understands why the board was cleared.
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
    await window.__chessTheory!.submit('Nf3')
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

test('parent-prefix autoplay is off by default', async ({ page }) => {
  await page.goto('/openings/e4/family/italian-game')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.state?.()))

  const state = await page.evaluate(() => window.__chessTheory!.state() as {
    expectedSan: string | null
  } | null)
  expect(state?.expectedSan).toBe('e4')
})

test('profile toggle enables parent-prefix autoplay', async ({ page }) => {
  await page.goto('/profile')
  const toggle = page.getByTestId('profile-toggle-parent-autoplay')
  await toggle.click()
  await expect(toggle).toContainText('Aktiv')

  await page.goto('/openings/e4/family/italian-game')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.state?.()))

  const state = await page.evaluate(() => window.__chessTheory!.state() as {
    expectedSan: string | null
  } | null)
  expect(state?.expectedSan).not.toBe('e4')
})

test('with autoplay off, an Italian Game line starts in intro phase prompting the user to play e4 manually (without arrow)', async ({
  page,
}) => {
  // Regression: parent moves must be prompted, not taught. The session
  // starts in `intro` phase with expectedSan === 'e4' (the topic's first
  // move, treated as a virtual parent), and no hint arrow is armed –
  // `isNewStepMove` gates the hint to the building phase so the user has
  // to recall the move from memory.
  await page.goto('/openings/e4/family/italian-game')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.state?.()))

  const state = await page.evaluate(() => window.__chessTheory!.state() as {
    phase: string
    expectedSan: string | null
  } | null)
  expect(state?.phase).toBe('intro')
  expect(state?.expectedSan).toBe('e4')

  // Give the post-mount tick a moment and confirm the hint arrow is NOT
  // drawn while we are in intro (no arrow for parent prompts).
  await page.waitForTimeout(200)
  const hint = await page.evaluate(() => window.__chessTheory!.hint())
  expect(hint.active).toBe(false)
})

test('the learn header renders topic/family in a <p> and the full line name in <h1>', async ({
  page,
}) => {
  // Regression: the original heading styling with a small topic label and
  // a bold h1 for the full line name was lost in an earlier rewrite. Pin
  // the structure so follow-up refactors cannot silently flatten it.
  await page.goto('/openings/e4/family/italian-game')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.waitForSelector('cg-board')

  const topicLabel = page.locator('.learn-layout > div.min-w-0 > p').first()
  await expect(topicLabel).toContainText('e4')
  await expect(topicLabel).toContainText('Italian Game')

  const heading = page.getByTestId('learn-line-heading')
  await expect(heading).toBeVisible()
  const tag = await heading.evaluate((el) => el.tagName.toLowerCase())
  expect(tag).toBe('h1')
  const text = await heading.textContent()
  expect((text ?? '').trim().length).toBeGreaterThan(0)
})

test('after mastering a line the selection broadens so the next unmastered sibling is picked (progression regression)', async ({
  page,
}) => {
  // Regression: when the selection focuses on a specific line with
  // `exclusive: true` (e.g. after navigating via "Vorherige Folge") the
  // next `selectLineForFocus` call would keep returning the same line
  // even after it was mastered. We now broaden the focus to the
  // containing family on completion so progression continues.
  await setParentAutoplay(page, true)
  await page.goto('/openings/e4/family/italian-game')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.currentLine?.()))

  const initialLineId = await page.evaluate(
    () => (window.__chessTheory!.currentLine() as { id: string }).id,
  )

  // Drive the current line through to phase=done via the e2e bridge.
  let safety = 0
  while (safety < 500) {
    safety += 1
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

  // After done, the learn page should auto-advance to the next
  // unmastered sibling in the same family (or topic). Poll until the
  // currentLine id changes.
  await page.waitForFunction(
    (prev) => {
      const cur = window.__chessTheory!.currentLine() as { id: string } | null
      return !!cur && cur.id !== prev
    },
    initialLineId,
    { timeout: 10_000 },
  )
  const nextLineId = await page.evaluate(
    () => (window.__chessTheory!.currentLine() as { id: string }).id,
  )
  expect(nextLineId).not.toBe(initialLineId)
})

test('clicking "Überspringen" on a line marks it mastered and advances to the next line (progression regression)', async ({
  page,
}) => {
  // Regression: skipping was leaving the selection pinned to the just-
  // skipped line (via `exclusive: true`), so the next pick would return
  // the same line and progression would stall on "Überspringen". The
  // broadenSelectionAfterCompletion helper now widens the focus to the
  // family after skipping.
  await page.goto('/openings/e4/family/italian-game')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.waitForSelector('cg-board')
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.currentLine?.()))

  const initialLineId = await page.evaluate(
    () => (window.__chessTheory!.currentLine() as { id: string }).id,
  )

  await page.getByRole('button', { name: 'Mehr' }).click()
  await expect(page.getByRole('heading', { name: 'Aktionen' })).toBeVisible()
  await page.getByRole('button', { name: 'Überspringen' }).click()

  // The modal should close first and the bridge's currentLine ref must
  // advance to the next unmastered sibling within a reasonable budget.
  await expect(page.getByRole('heading', { name: 'Aktionen' })).toHaveCount(0)
  await page.waitForFunction(
    (prev) => {
      const cur = window.__chessTheory!.currentLine() as { id: string } | null
      return !!cur && cur.id !== prev
    },
    initialLineId,
    { timeout: 10_000 },
  )
  const nextId = await page.evaluate(
    () => (window.__chessTheory!.currentLine() as { id: string }).id,
  )
  expect(nextId).not.toBe(initialLineId)
})

test('history navigation: back button is disabled at start, enables once the user has played a move, and forward is bounded by maxReplayPly', async ({
  page,
}) => {
  // Regression: the back/forward buttons in the bottom toolbar drive an
  // in-game undo/redo – NOT the learning progression. Back must be
  // disabled until at least one ply is on the board, and forward can
  // never point past the live session's expectedMoveIndex (i.e. it
  // cannot reveal an un-learned future move).
  await setParentAutoplay(page, true)
  await page.goto('/openings/e4/family/italian-game')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.waitForSelector('cg-board')

  const back = page.getByRole('button', { name: 'Zurück' })
  const forward = page.getByRole('button', { name: 'Vor' })

  // At session start with autoplay on, the opponent may have played
  // their opening ply already which enables the back button. Regardless
  // of that, the forward button must be disabled because viewedPly ==
  // maxReplayPly at start.
  await expect(forward).toBeDisabled()

  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.state?.()))

  // Play one user move via the e2e bridge. After this the back button
  // must be enabled because at least one ply has been played.
  await page.evaluate(async () => {
    const s = window.__chessTheory!.state() as { expectedSan: string }
    await window.__chessTheory!.submit(s.expectedSan)
  })

  await page.waitForFunction(() => {
    const s = window.__chessTheory!.state() as { expectedMoveIndex: number } | null
    return !!s && s.expectedMoveIndex > 0
  })

  await expect(back).toBeEnabled()
})

test('premove support: consecutive user moves across an opponent reply reach the next user move without errors', async ({
  page,
}) => {
  // Regression: premoves used to be dropped silently when the user
  // played ahead of the opponent's auto-reply. This exercises the
  // happy-path of the bridge submit pipeline: Nf3 → (opponent Nc6
  // auto-played, step boundary resets to prefix) → Bc4. The session
  // must correctly route the second user move even though a board reset
  // happens between the two.
  await setParentAutoplay(page, true)
  await page.goto('/openings/e4/family/italian-game')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.currentLine?.()))
  await page.waitForFunction(() => window.__chessTheory!.hint().active === true)

  // Italian Game 1. e4 e5 2. Nf3 Nc6 3. Bc4 – with autoplay on the first
  // user step is Nf3. After Nf3 we manually submit the opponent's e5
  // (simulating the reset replay) so that the session can accept Bc4.
  await page.evaluate(async () => {
    await window.__chessTheory!.submit('Nf3')
  })
  await page.waitForFunction(() => {
    const s = window.__chessTheory!.state() as {
      currentStep: number
      expectedMoveIndex: number
    } | null
    return !!s && s.currentStep === 2 && s.expectedMoveIndex === 1
  })

  await page.evaluate(async () => {
    await window.__chessTheory!.submit('e5')
    await window.__chessTheory!.submit('Nf3')
  })

  // After replaying Nf3 from memory the opponent auto-plays Nc6 and the
  // next expected user move is Bc4. Submitting Bc4 must land cleanly.
  await page.waitForFunction(() => {
    const s = window.__chessTheory!.state() as {
      expectedSan: string | null
    } | null
    return !!s && s.expectedSan === 'Bc4'
  })

  await page.evaluate(async () => {
    await window.__chessTheory!.submit('Bc4')
  })

  await page.waitForFunction(() => {
    const s = window.__chessTheory!.state() as {
      phase: string
      expectedMoveIndex: number
    } | null
    return !!s && (s.expectedMoveIndex >= 5 || s.phase === 'repeating')
  })
})

test('handleUserMove buffering: premove during opponent-in-flight is queued via the learn page', async ({
  page,
}) => {
  // Regression: the learn page holds a `pendingUserMove` buffer that
  // captures a user click while the opponent is in flight and flushes
  // it after the opponent's move lands. We cannot directly race the
  // board from e2e, so we pin the CONTRACT instead: after the opponent
  // auto-replies on a step boundary the bridge's state.expectedSan must
  // have advanced to the NEXT user move. A regression in the buffering
  // would leave the session in a stale state waiting on the previous
  // user move or on a non-matching SAN.
  await setParentAutoplay(page, true)
  await page.goto('/openings/e4/family/italian-game')
  const firstRow = page.locator('ul > li').first()
  await firstRow.getByRole('button', { name: 'Üben' }).click()
  await page.waitForURL(/\/learn$/)
  await page.goto('/learn?e2e=1')
  await page.waitForFunction(() => Boolean(window.__chessTheory?.currentLine?.()))
  await page.waitForFunction(() => window.__chessTheory!.hint().active === true)

  await page.evaluate(async () => {
    await window.__chessTheory!.submit('Nf3')
  })
  // The session must have fully transitioned to currentStep=2 waiting at
  // the prefix for the opponent's e5, i.e. expectedMoveIndex=1.
  await page.waitForFunction(() => {
    const s = window.__chessTheory!.state() as {
      currentStep: number
      expectedMoveIndex: number
    } | null
    return !!s && s.currentStep === 2 && s.expectedMoveIndex === 1
  })
})
