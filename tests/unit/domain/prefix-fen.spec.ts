import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { fenAfterFirstNSans, standardStartFen } from '~/domain/prefix-fen'

describe('prefix-fen', () => {
  it('returns standard start for zero plies', () => {
    expect(fenAfterFirstNSans(['e4'], 0)).toBe(standardStartFen())
  })

  it('returns FEN after N prefix SANs', () => {
    const expected = new Chess()
    expected.move('e4')
    expected.move('e5')
    expect(fenAfterFirstNSans(['e4', 'e5', 'Nf3'], 2)).toBe(expected.fen())
  })

  it('returns null when a SAN cannot be replayed', () => {
    expect(fenAfterFirstNSans(['e4'], 2)).toBeNull()
    expect(fenAfterFirstNSans(['not-a-move'], 1)).toBeNull()
  })
})
