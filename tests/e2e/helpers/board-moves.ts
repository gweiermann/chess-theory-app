import type { Chess } from 'chess.js'
import type { Page } from '@playwright/test'
import {
  ANIM_BUFFER_MS,
  NEXT_LINE_DELAY_MS,
  OPPONENT_DELAY_MS,
  PREFIX_REPLAY_DELAY_MS,
  STEP_RESET_DELAY_MS,
} from './prd-constants'

const boardRoot = (page: Page) => page.locator('cg-board').first()

const squareCenter = (
  box: { x: number; y: number; width: number; height: number },
  sq: string,
  orientation: 'white' | 'black',
): { x: number; y: number } => {
  const file = sq.charCodeAt(0) - 'a'.charCodeAt(0)
  const rankNum = Number.parseInt(sq[1] ?? '0', 10)
  const col = orientation === 'white' ? file : 7 - file
  const row = orientation === 'white' ? 8 - rankNum : rankNum - 1
  return {
    x: box.x + (col + 0.5) * (box.width / 8),
    y: box.y + (row + 0.5) * (box.height / 8),
  }
}

export const clickSanOnBoard = async (
  page: Page,
  game: Chess,
  san: string,
  orientation: 'white' | 'black' = 'white',
): Promise<void> => {
  const beforeFen = game.fen()
  const move = game.move(san)
  if (!move) {
    throw new Error(`Illegal SAN "${san}" from FEN ${beforeFen}`)
  }
  const board = boardRoot(page)
  await page.evaluate(() => document.dispatchEvent(new Event('scroll')))
  const box = await board.boundingBox()
  if (!box) {
    throw new Error('cg-board has no layout box yet')
  }
  const from = squareCenter(box, move.from, orientation)
  const to = squareCenter(box, move.to, orientation)
  await page.mouse.click(from.x, from.y)
  await page.mouse.click(to.x, to.y)
  await page.waitForTimeout(ANIM_BUFFER_MS)
}

export const waitOpponentChain = async (page: Page): Promise<void> => {
  await page.waitForTimeout(OPPONENT_DELAY_MS + ANIM_BUFFER_MS)
}

export const waitAfterResetBoundary = async (page: Page): Promise<void> => {
  await page.waitForTimeout(STEP_RESET_DELAY_MS + PREFIX_REPLAY_DELAY_MS + ANIM_BUFFER_MS)
}

export const waitNextLineScheduled = async (page: Page): Promise<void> => {
  await page.waitForTimeout(NEXT_LINE_DELAY_MS + ANIM_BUFFER_MS)
}
