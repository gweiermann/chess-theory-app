import { describe, expect, it } from 'vitest'
import {
  isNewStepMove,
  startSession,
  submitMove,
} from '~/domain/session'
import type { SessionState } from '~/domain/session'
import type { Line } from '~/domain/types'

const lineWhite: Line = {
  id: 'l',
  eco: '',
  fullName: 'White line',
  pgn: '',
  // user is white: user moves are at even ply indices 0, 2, 4
  sanMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'],
  userSide: 'white',
}

const playAll = (state: SessionState, sans: string[]): SessionState => {
  let s = state
  for (const san of sans) {
    const r = submitMove(s, san)
    expect(r.result).toBe('correct')
    s = r.state
  }
  return s
}

describe('isNewStepMove', () => {
  it('returns true at the very first user move of step 1', () => {
    const state = startSession(lineWhite)
    expect(state.expectedMoveIndex).toBe(0)
    expect(isNewStepMove(state)).toBe(true)
  })

  it('returns false when the next expected move is an opponent move', () => {
    // Reach step 2: replay from start; after e4 we expect opponent e5 at idx 1.
    let state = startSession(lineWhite)
    state = playAll(state, ['e4'])
    expect(state.currentStep).toBe(2)
    state = playAll(state, ['e4'])
    expect(state.expectedMoveIndex).toBe(1)
    expect(isNewStepMove(state)).toBe(false)
  })

  it("returns true when the position reaches step 2's new user move", () => {
    let state = startSession(lineWhite)
    state = playAll(state, ['e4'])
    state = playAll(state, ['e4', 'e5'])
    expect(state.currentStep).toBe(2)
    expect(state.expectedMoveIndex).toBe(2)
    expect(isNewStepMove(state)).toBe(true)
  })

  it('returns false during the repeating phase', () => {
    let state = startSession(lineWhite)
    state = playAll(state, ['e4'])
    state = playAll(state, ['e4', 'e5', 'Nf3'])
    state = playAll(state, ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'])
    expect(state.phase).toBe('repeating')
    expect(isNewStepMove(state)).toBe(false)
  })
})
