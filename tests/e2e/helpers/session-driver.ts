import { Chess } from 'chess.js'
import type { Page } from '@playwright/test'
import type { LearnPlayPage } from '../pages/learn-play.page'
import { clickSanOnBoard } from './board-moves'

const SETTLE_MS = 950

/** After 1.e4 on the board, Italian root lines usually continue …e5. Keeps chess.js in sync with the UI opponent. */
const mirrorItalianBlackReplyAfterE4 = (game: Chess): void => {
  if (game.turn() !== 'b') return
  const hist = game.history({ verbose: true })
  const last = hist.at(-1)
  if (last?.color === 'w' && last.san === 'e4' && game.get('e5') === null) {
    game.move('e5')
  }
}

/** Italian family root (C50) continues 2…Nc6 after 2.Nf3; keeps tests in sync with UI autoplay. */
const mirrorItalianBlackNc6AfterWhiteNf3 = (game: Chess): void => {
  if (game.turn() !== 'b') return
  const h = game.history()
  if (h.length === 3 && h[0] === 'e4' && h[1] === 'e5' && h[2] === 'Nf3') {
    game.move('Nc6')
  }
}

/** After 3.Bc4 in the C50 Italian sequence, Black usually answers …Bc5 (Giuoco-style). */
const mirrorItalianBlackBc5AfterWhiteBc4 = (game: Chess): void => {
  if (game.turn() !== 'b') return
  if (game.history().at(-1) !== 'Bc4') return
  const opts = game.moves({ verbose: true })
  const bc5 = opts.find((m) => m.san === 'Bc5')
  if (bc5) {
    game.move(bc5)
    return
  }
  const nf6 = opts.find((m) => m.san === 'Nf6')
  if (nf6) game.move(nf6)
}

export const settleAfterPly = async (page: Page): Promise<void> => {
  await page.waitForTimeout(SETTLE_MS)
}

export const playSanFromUi = async (
  page: Page,
  learnPlay: LearnPlayPage,
  game: Chess,
  boardOrientation: 'white' | 'black' = 'white',
  sanOverride?: string,
): Promise<void> => {
  const san = sanOverride ?? (await learnPlay.readNextSanFromUi())
  await clickSanOnBoard(page, game, san, boardOrientation)
  await settleAfterPly(page)
  mirrorItalianBlackReplyAfterE4(game)
  mirrorItalianBlackNc6AfterWhiteNf3(game)
  mirrorItalianBlackBc5AfterWhiteBc4(game)
}

export const isLineMastered = async (
  page: Page,
  topicId: string,
  lineId: string,
): Promise<boolean> => {
  return page.evaluate(
    ([t, l]) => {
      const raw = localStorage.getItem('chess-theory:v1:progress')
      if (!raw) return false
      const d = JSON.parse(raw) as { byTopic?: Record<string, Record<string, { status?: string }>> }
      return d.byTopic?.[t]?.[l]?.status === 'mastered'
    },
    [topicId, lineId],
  )
}

export const initItalianAutoplayGame = (): Chess => new Chess()

/** Mirror the Italian board after 1.e4 e5 when the UI has already played both (autoplay / prefix). */
export const mirrorItalianAfterE5 = (): Chess => {
  const g = new Chess()
  g.move('e4')
  g.move('e5')
  return g
}

export const initMaroczyBlackGame = (): Chess => {
  const g = new Chess()
  g.move('e4')
  return g
}
