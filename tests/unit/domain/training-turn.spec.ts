import { describe, expect, it } from 'vitest'
import type { Line } from '~/domain/types'
import { isOpponentPly, isPlayHelpBlockedAtView, isPlayHelpStructurallyDisabled } from '~/domain/training-turn'

const line = (sanMoves: string[], userSide: Line['userSide']): Pick<Line, 'sanMoves' | 'userSide'> => ({
  sanMoves,
  userSide,
})

describe('training-turn', () => {
  it('isOpponentPly matches side-to-move vs user color', () => {
    const w = line(['e4', 'e5', 'Nf3'], 'white')
    expect(isOpponentPly(w, 0)).toBe(false)
    expect(isOpponentPly(w, 1)).toBe(true)

    const b = line(['e4', 'e5', 'Nf3'], 'black')
    expect(isOpponentPly(b, 0)).toBe(true)
    expect(isOpponentPly(b, 1)).toBe(false)
  })

  it('isPlayHelpStructurallyDisabled is independent of board hint state', () => {
    const w = line(['e4', 'e5', 'Nf3'], 'white')
    expect(isPlayHelpStructurallyDisabled(w, 0)).toBe(false)
    expect(isPlayHelpStructurallyDisabled(w, 1)).toBe(true)
    expect(isPlayHelpStructurallyDisabled(null, 0)).toBe(true)
  })

  it('isPlayHelpBlockedAtView disables Hilfe while scrubbing move history', () => {
    const w = line(['e4', 'e5', 'Nf3'], 'white')
    expect(isPlayHelpBlockedAtView(w, 0, true)).toBe(true)
    expect(isPlayHelpBlockedAtView(w, 1, true)).toBe(true)
    expect(isPlayHelpBlockedAtView(w, 0, false)).toBe(false)
    expect(isPlayHelpBlockedAtView(w, 1, false)).toBe(true)
  })
})
