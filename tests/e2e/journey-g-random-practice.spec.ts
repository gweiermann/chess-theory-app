/**
 * PRD: §4.4 Journey F — Random Opening Trainer (/learn/practice).
 * Plays through a round via the dev bridge (canonical move hint) and verifies
 * scoring, streak, the multi-answer wrong-move hint, and the manual continue.
 */
import { expect, test } from './fixtures/chess-app.fixture'
import { seedMasteredLine } from './helpers/storage-seed'
import { E2E_MAX_WAIT_MS } from './helpers/prd-constants'
import type { LearnPracticePage } from './pages/learn-practice.page'

const TOPIC = 'e4'
// Two Bishop's Opening lines share the prefix 1.e4 e5 2.Bc4, so a round is
// deterministic: user plays e4, computer e5, user Bc4, computer Bc5 → done.
const LINE_A = 'C23-bishops-opening'
const LINE_B = 'C23-bishops-opening-boi-variation'
// Black Two Knights base line (user plays as Black against 1.e4 e5 2.Nf3).
const LINE_TWO_KNIGHTS_BLACK = 'C58-italian-game-two-knights-defense'

const seedTwoMastered = async (page: Parameters<typeof seedMasteredLine>[0]): Promise<void> => {
  await seedMasteredLine(page, TOPIC, LINE_A)
  await seedMasteredLine(page, TOPIC, LINE_B)
}

const seedDistinctMastered = async (page: Parameters<typeof seedMasteredLine>[0]): Promise<void> => {
  await seedMasteredLine(page, TOPIC, LINE_B)
  await seedMasteredLine(page, 'other', 'A00-van-geet-opening-billockus-johansen-gambit')
}

const playCleanRound = async (practice: LearnPracticePage): Promise<void> => {
  let san = await practice.readNextSan()
  await practice.submitDevSan(san)
  await expect(practice.score()).toHaveText('1')
  await expect(practice.streak()).toHaveText('1')
  san = await practice.readNextSan('e4')
  await practice.submitDevSan(san)
}

test.describe.serial('Journey G', () => {
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => undefined)
  })

test('G1 Zufallsmodus card routes to the practice page without a phase banner', async ({
  learnPractice,
}) => {
  await seedTwoMastered(learnPractice.page)
  await learnPractice.openViaLearnHub()
  await expect(learnPractice.board()).toBeVisible()
  await expect(learnPractice.phaseLabel()).toHaveCount(0)
})

test('G2 shows an empty-state when nothing is mastered', async ({ learnPractice }) => {
  await learnPractice.gotoDirect()
  await expect(
    learnPractice.page.getByText(/Noch keine gelernten Eröffnungen/),
  ).toBeVisible({ timeout: E2E_MAX_WAIT_MS })
})

test('G3 practice keeps target and success status out of the learner UI', async ({
  learnPractice,
  page,
}) => {
  await seedTwoMastered(learnPractice.page)
  await learnPractice.openViaLearnHub()
  await expect(learnPractice.score()).toHaveText('0')
  await expect(learnPractice.targetLine()).toHaveCount(0)
  await expect(page.getByTestId('practice-focus')).toHaveCount(0)
  await expect(page.getByTestId('continue-target-met')).toHaveCount(0)

  const firstSan = await learnPractice.readNextSan()
  await learnPractice.submitDevSan(firstSan)
  await expect(learnPractice.score()).toHaveText('1')
  await expect(page.getByText(/Korrekt:/)).toHaveCount(0, { timeout: 100 })

  const secondSan = await learnPractice.readNextSan(firstSan)
  await learnPractice.submitDevSan(secondSan)

  await expect(learnPractice.continueBar()).toBeVisible({ timeout: E2E_MAX_WAIT_MS })
  await expect(learnPractice.continuePoints()).toHaveText('7') // 2 moves + 5 bonus
  await expect(learnPractice.continueMistakes()).toHaveText('0')
  await expect(learnPractice.score()).toHaveText('7')

  // The only maximal target was completed first-try, so it is unavailable
  // for the remainder of this browser session.
  await expect(learnPractice.continueButton()).toBeDisabled()
  await expect(learnPractice.continueButton()).toHaveText('Sitzung fertig')
})

test('G4 a wrong move does not end the round and shows all continuations', async ({
  learnPractice,
  page,
}) => {
  await seedTwoMastered(learnPractice.page)
  await learnPractice.openViaLearnHub()

  await learnPractice.submitDevSan('d4') // not a learned continuation → wrong
  await expect(learnPractice.streak()).toHaveText('0')
  await expect(page.getByText(/Möglich:\s*e4/)).toBeVisible({ timeout: E2E_MAX_WAIT_MS })

  // wait out the wrong-move undo, then recover with the correct continuation
  await page.waitForTimeout(500)
  let san = await learnPractice.readNextSan()
  await learnPractice.submitDevSan(san)
  await expect(learnPractice.score()).toHaveText('1')

  // finish the round; the mistake withholds the bonus
  san = await learnPractice.readNextSan('e4')
  await learnPractice.submitDevSan(san)
  await expect(learnPractice.continueBar()).toBeVisible({ timeout: E2E_MAX_WAIT_MS })
  await expect(learnPractice.continuePoints()).toHaveText('2') // 2 moves, no bonus
  await expect(learnPractice.continueMistakes()).toHaveText('1')
})

test('G5 the board stays in sync with the session across dev-bridge and wrong moves', async ({
  learnPractice,
}) => {
  await seedTwoMastered(learnPractice.page)
  await learnPractice.openViaLearnHub()

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  const boardFen = async (): Promise<string> =>
    (await learnPractice.devBoardFen().textContent()) ?? ''
  const nodeFen = async (): Promise<string> =>
    (await learnPractice.devNodeFen().textContent()) ?? ''
  // Re-reads both FEN text nodes each tick until the physical board reflects
  // the session node exactly (the session node updates just after the board
  // during a reply, so a one-shot capture would race).
  const waitSynced = async (): Promise<void> => {
    await learnPractice.page.waitForFunction(
      () => {
        const b = document.querySelector('[data-testid="dev-board-fen"]')?.textContent?.trim() ?? ''
        const n = document.querySelector('[data-testid="dev-node-fen"]')?.textContent?.trim() ?? ''
        return Boolean(b && n && b === n)
      },
      undefined,
      { timeout: E2E_MAX_WAIT_MS },
    )
  }

  // The physical board must mirror the session node exactly.
  expect(await boardFen()).toBe(START_FEN)
  expect(await boardFen()).toBe(await nodeFen())

  // A correct move (e4) via the dev bridge: the computer's reply must land ON
  // the board (the board advances past the empty start) and stay in lock-step.
  await learnPractice.submitDevSan('e4')
  await waitSynced()
  expect(await boardFen()).not.toBe(START_FEN)
  expect(await boardFen()).toBe(await nodeFen())

  // A wrong move (Nf3) after the board already has moves: the undo must snap
  // the board back to the node — not pop an unrelated earlier ply and desync.
  await learnPractice.submitDevSan('Nf3')
  await waitSynced()

  // A listed continuation is then accepted and the board keeps in lock-step.
  const san = await learnPractice.readNextSan('Nf3')
  await learnPractice.submitDevSan(san)
  await expect(learnPractice.score()).toHaveText('2')
  await learnPractice.page.waitForTimeout(1000)
  await waitSynced()
  expect(await boardFen()).toBe(await nodeFen())
})

test('G6 snaps a dev-bridge move before animating the opponent reply', async ({
  learnPractice,
}) => {
  await seedTwoMastered(learnPractice.page)
  await learnPractice.openViaLearnHub()

  const frames = learnPractice.page.evaluate(async () => {
    const captured: string[][] = []
    for (let i = 0; i < 18; i += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      captured.push(
        [...document.querySelectorAll('cg-board piece.anim')].map((piece) => piece.className),
      )
    }
    return captured
  })
  await learnPractice.submitDevSan('e4')
  const animatedPieces = (await frames).flat()

  expect(animatedPieces).toContain('black pawn anim')
  expect(animatedPieces).not.toContain('white pawn anim')
})

test('G8 wrong knight-mirror reply restores to the Two Knights node, not a d4 branch', async ({
  learnPractice,
}) => {
  // User-reported defect: while practicing as Black against 1.e4 e5 2.Nf3, a
  // wrong knight-mirror (Nf6) made the board appear to jump to a different
  // variation (White having played 2.d4). Regression: the wrong-move restore
  // must snap back to the authoritative session node — the Two Knights
  // position with the knight on f3 — never a d4 branch.
  const TWO_KNIGHTS_FEN =
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
  const DANISH_D4_FEN =
    'rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2'

  await seedMasteredLine(learnPractice.page, 'e4', LINE_TWO_KNIGHTS_BLACK)
  await learnPractice.openViaLearnHub()

  const boardFen = async (): Promise<string> =>
    (await learnPractice.devBoardFen().textContent()) ?? ''
  const nodeFen = async (): Promise<string> =>
    (await learnPractice.devNodeFen().textContent()) ?? ''
  const waitSynced = async (): Promise<void> => {
    await learnPractice.page.waitForFunction(
      () => {
        const b = document.querySelector('[data-testid="dev-board-fen"]')?.textContent?.trim() ?? ''
        const n = document.querySelector('[data-testid="dev-node-fen"]')?.textContent?.trim() ?? ''
        return Boolean(b && n && b === n)
      },
      undefined,
      { timeout: E2E_MAX_WAIT_MS },
    )
  }

  // the computer (White) opens 1.e4 for the Black user
  const firstSan = await learnPractice.readNextSan()
  expect(firstSan).toBe('e5')
  await learnPractice.submitDevSan('e5')
  await waitSynced()

  // the computer replies 2.Nf3; the board lands on the Two Knights position
  expect(await boardFen()).toBe(TWO_KNIGHTS_FEN)
  expect(await boardFen()).toBe(await nodeFen())

  // the user mirrors the knight with Nf6 — a wrong move
  await learnPractice.submitDevSan('Nf6')
  await expect(learnPractice.streak()).toHaveText('0')
  // Wait past the wrong-move undo (WRONG_UNDO_DELAY_MS = 200) so the assertion
  // observes the board *after* the restore, not the pre-undo position.
  await learnPractice.page.waitForTimeout(400)
  await waitSynced()

  // the undo restore returned to the Two Knights node — never a d4 branch
  expect(await boardFen()).toBe(await nodeFen())
  expect(await boardFen()).toBe(TWO_KNIGHTS_FEN)
  expect(await boardFen()).not.toBe(DANISH_D4_FEN)
})

test('G7 does not repeat a first-try target during this practice session', async ({
  learnPractice,
}) => {
  // Keep focus on the selected family. Before the exclusion policy this
  // deterministic setup replayed its only line after a perfect round.
  await learnPractice.page.addInitScript(() => {
    Math.random = () => 0.99
  })
  await seedDistinctMastered(learnPractice.page)
  await learnPractice.openViaLearnHub()

  const firstTargetId = (await learnPractice.devTargetId().textContent())?.trim() ?? ''
  const firstSan =
    firstTargetId === 'A00-van-geet-opening-billockus-johansen-gambit' ? 'Nc3' : 'e4'
  await learnPractice.submitDevSan(firstSan)
  await expect(learnPractice.score()).toHaveText('1')
  const secondSan = await learnPractice.readNextSan(firstSan)
  await learnPractice.submitDevSan(secondSan)
  await expect(learnPractice.continueBar()).toBeVisible({ timeout: E2E_MAX_WAIT_MS })
  await expect(learnPractice.page.getByTestId('dev-target-met')).toHaveText('true')

  await learnPractice.continueButton().click()
  await expect
    .poll(async () => (await learnPractice.devTargetId().textContent())?.trim() ?? '')
    .not.toBe(firstTargetId)
})
})
