import { describe, expect, it } from 'vitest'
import {
  prepareDevPlayBoardForUserSubmit,
  type DevPlayBoardHandle,
} from '~/components/play/prepareDevPlayBoardForUserSubmit'

describe('prepareDevPlayBoardForUserSubmit', () => {
  it('returns no-board when the board ref is missing', () => {
    expect(prepareDevPlayBoardForUserSubmit(null, 'e4')).toEqual({
      ok: false,
      reason: 'no-board',
    })
  })

  it('returns illegal-move when playOpponentSan fails', () => {
    const board: DevPlayBoardHandle = {
      playOpponentSan: () => false,
    }
    expect(prepareDevPlayBoardForUserSubmit(board, 'e4')).toEqual({
      ok: false,
      reason: 'illegal-move',
    })
  })

  it('returns ok when the SAN was applied on the board', () => {
    const board: DevPlayBoardHandle = {
      playOpponentSan: (san) => san === 'e4',
    }
    expect(prepareDevPlayBoardForUserSubmit(board, 'e4')).toEqual({ ok: true })
  })
})
