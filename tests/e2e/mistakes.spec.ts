import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { Chess } from 'chess.js'
import { readFile } from 'node:fs/promises'
import { terminalLines } from '../../app/modules/openings'
import type { Family } from '../../app/modules/shared'
import type { MistakeDataset } from '../../app/modules/mistakes'

const history = async (page: Page) =>
  (await page.getByLabel('Gespielte Züge').innerText())
    .replace(/\d+\./g, '')
    .trim()
    .split(/\s+/)
    .filter((move) => move !== 'Grundstellung')
async function play(page: Page, moves: readonly string[], san: string) {
  const game = new Chess()
  for (const move of moves) game.move(move)
  const move = game.move(san)
  await page.getByTestId(`square-${move.from}`).click()
  await page.getByTestId(`square-${move.to}`).click()
}

test('experimental mode follows theory, signals a verified slip, restores it and trains its continuation', async ({
  page,
}) => {
  const family: Family = JSON.parse(
    await readFile('public/data/families/italian-game-a79f8e15.json', 'utf8'),
  )
  const dataset: MistakeDataset = JSON.parse(
    await readFile('public/data/mistakes/italian-game-a79f8e15.json', 'utf8'),
  )
  const lines = terminalLines(family.lines).sort(
    (a, b) => b.moves.length - a.moves.length || a.id.localeCompare(b.id),
  )
  await page.addInitScript(() => {
    let calls = 0
    Math.random = () => ((++calls % 1000) + 1) / 100000
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Mit Fehlern spielen →' }).click()
  await expect(page.getByTestId('square-c4')).toHaveAttribute('data-piece', 'b')
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  for (let turn = 0; turn < 20; turn++) {
    if (
      (await page.getByTestId('training-phase').innerText()) ===
      'Fehler ausnutzen'
    )
      break
    await page.clock.runFor(900)
    if (
      (await page.getByTestId('training-phase').innerText()) ===
      'Fehler ausnutzen'
    )
      break
    const moves = await history(page)
    const next = lines.find((line) =>
      moves.every((move, index) => line.moves[index] === move),
    )?.moves[moves.length]
    expect(next).toBeTruthy()
    await play(page, moves, next!)
  }
  await expect(page.getByTestId('training-phase')).toHaveText(
    'Fehler ausnutzen',
  )
  const moves = await history(page)
  const branch = dataset.branches.find(
    (branch) =>
      JSON.stringify([...branch.history, branch.mistake]) ===
      JSON.stringify(moves),
  )!
  expect(branch).toBeTruthy()
  const bounds = await page.locator('.board-view').boundingBox()
  await page.reload()
  await expect(page.getByTestId('training-phase')).toHaveText(
    'Fehler ausnutzen',
  )
  expect(await history(page)).toEqual(moves)
  expect(await page.locator('.board-view').boundingBox()).toEqual(bounds)
  const game = new Chess()
  for (const san of moves) game.move(san)
  const wrong = game
    .moves()
    .find((san) => !branch.paths.some((path) => path.moves[0] === san))!
  await play(page, moves, wrong)
  await play(page, moves, wrong)
  expect(await history(page)).toEqual(moves)
  await expect(page.locator('svg [data-purpose="solution"]')).toBeVisible()
  const continuation = branch.paths[0]!.moves
  for (const san of continuation) {
    const current = await history(page)
    if (current.length % 2 === 0) await play(page, current, san)
    else await page.clock.runFor(900)
  }
  await expect(page.getByTestId('round-complete')).toHaveText(
    'Vorteil gesichert.',
  )
  expect(await page.locator('.board-view').boundingBox()).toEqual(bounds)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight > innerHeight,
    ),
  ).toBe(false)
})
