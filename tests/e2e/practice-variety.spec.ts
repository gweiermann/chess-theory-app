import { test, expect } from '@playwright/test'
import { Chess } from 'chess.js'
import { readFile } from 'node:fs/promises'
import type { Family } from '../../app/modules/shared'

test('free play offers three different leaves then a familiar review, across a reload', async ({
  page,
}) => {
  const family: Family = JSON.parse(
    await readFile('public/data/families/italian-game-a79f8e15.json', 'utf8'),
  )
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Italienisch spielen →' }).click()
  await expect(page.getByTestId('square-c4')).toHaveAttribute('data-piece', 'b')
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  const practiced: string[] = []
  for (let round = 0; round < 4; round++) {
    const id = new URL(page.url()).searchParams.get('line')!
    if (round < 3) expect(practiced).not.toContain(id)
    else expect(practiced).toContain(id)
    practiced.push(id)
    const line = family.lines.find((candidate) => candidate.id === id)!
    const game = new Chess()
    for (let ply = 0; ply < line.moves.length; ply++) {
      const move = game.move(line.moves[ply]!)
      if (ply < 5) continue
      if (ply % 2 === 1) await page.clock.runFor(900)
      else {
        await page.getByTestId(`square-${move.from}`).click()
        await page.getByTestId(`square-${move.to}`).click()
      }
    }
    await expect(page.getByTestId('round-complete')).toBeVisible()
    if (round < 3) {
      await page.clock.resume()
      await page.getByRole('button', { name: 'Nächste Runde →' }).click()
      await expect
        .poll(() => new URL(page.url()).searchParams.get('line'))
        .not.toBe(id)
      if (round === 1) {
        await page.reload()
        await expect(page.getByTestId('square-c4')).toHaveAttribute(
          'data-piece',
          'b',
        )
      }
      await page.clock.pauseAt(
        new Date(await page.evaluate(() => Date.now() + 1000)),
      )
    }
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight > innerHeight,
    ),
  ).toBe(false)
})
