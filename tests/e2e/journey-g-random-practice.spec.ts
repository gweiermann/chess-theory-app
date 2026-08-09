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

const seedTwoMastered = async (page: Parameters<typeof seedMasteredLine>[0]): Promise<void> => {
  await seedMasteredLine(page, TOPIC, LINE_A)
  await seedMasteredLine(page, TOPIC, LINE_B)
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

test('G1 Zufallsmodus card routes to the practice page', async ({ learnPractice }) => {
  await seedTwoMastered(learnPractice.page)
  await learnPractice.openViaLearnHub()
  await expect(learnPractice.phaseLabel()).toHaveText('Dein Zug')
})

test('G2 shows an empty-state when nothing is mastered', async ({ learnPractice }) => {
  await learnPractice.gotoDirect()
  await expect(
    learnPractice.page.getByText(/Noch keine gelernten Eröffnungen/),
  ).toBeVisible({ timeout: E2E_MAX_WAIT_MS })
})

test('G3 clean round scores +1 per move and +5 bonus, continue advances', async ({
  learnPractice,
}) => {
  await seedTwoMastered(learnPractice.page)
  await learnPractice.openViaLearnHub()
  await expect(learnPractice.score()).toHaveText('0')

  await playCleanRound(learnPractice)

  // computer plays Bc5 and the round completes with no mistakes → +5 bonus
  await expect(learnPractice.continueBar()).toBeVisible({ timeout: E2E_MAX_WAIT_MS })
  await expect(learnPractice.continuePoints()).toHaveText('7') // 2 moves + 5 bonus
  await expect(learnPractice.continueMistakes()).toHaveText('0')
  await expect(learnPractice.score()).toHaveText('7')

  // manual continue starts a fresh round, carrying the score
  await learnPractice.continueButton().click()
  await expect(learnPractice.round()).toHaveText('2')
  await expect(learnPractice.score()).toHaveText('7')
})

test('G4 a wrong move does not end the round and shows all continuations', async ({
  learnPractice,
  page,
}) => {
  await seedTwoMastered(learnPractice.page)
  await learnPractice.openViaLearnHub()

  await learnPractice.submitDevSan('d4') // not a learned continuation → wrong
  await expect(learnPractice.phaseLabel()).toHaveText('Dein Zug') // round continues
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
})
