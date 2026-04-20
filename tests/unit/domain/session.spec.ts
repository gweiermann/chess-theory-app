import { describe, expect, it } from 'vitest'
import {
  startSession,
  submitMove,
  TARGET_REPS,
  type SessionState,
} from '~/domain/session'
import type { Line } from '~/domain/types'

const italianGame: Line = {
  id: 'C50-italian-game',
  eco: 'C50',
  fullName: 'Italian Game',
  pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4',
  sanMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
  userSide: 'white',
}

const playMoves = (state: SessionState, moves: string[]): SessionState =>
  moves.reduce((acc, san) => submitMove(acc, san).state, state)

const playLine = (state: SessionState, line: Line): SessionState =>
  playMoves(state, line.sanMoves)

describe('session reducer', () => {
  it('starts in the building phase at step 1, total = user moves', () => {
    const state = startSession(italianGame)

    expect(state.line).toBe(italianGame)
    expect(state.phase).toBe('building')
    expect(state.currentStep).toBe(1)
    expect(state.totalSteps).toBe(3)
    expect(state.expectedMoveIndex).toBe(0)
    expect(state.expectedSan).toBe('e4')
    expect(state.repsDone).toBe(0)
  })

  it('finishes step 1 after just the first user move', () => {
    const state = startSession(italianGame)
    const next = submitMove(state, 'e4').state

    expect(next.currentStep).toBe(2)
    expect(next.expectedMoveIndex).toBe(0)
    expect(next.expectedSan).toBe('e4')
  })

  it('within step 2, advances ply by ply for opponent and user moves', () => {
    let state = startSession(italianGame)
    state = submitMove(state, 'e4').state

    state = submitMove(state, 'e4').state
    expect(state.expectedSan).toBe('e5')
    state = submitMove(state, 'e5').state
    expect(state.expectedSan).toBe('Nf3')
    state = submitMove(state, 'Nf3').state

    expect(state.currentStep).toBe(3)
    expect(state.expectedMoveIndex).toBe(0)
  })

  it('reports wrong on a mismatched move and keeps progress (lenient)', () => {
    let state = startSession(italianGame)
    state = submitMove(state, 'e4').state
    state = submitMove(state, 'e4').state

    const before = state.expectedMoveIndex
    const wrong = submitMove(state, 'd4')
    expect(wrong.result).toBe('wrong')
    expect(wrong.expected).toBe('e5')
    expect(wrong.state.expectedMoveIndex).toBe(before)
    expect(wrong.state.currentStep).toBe(2)
  })

  it('switches to repeating after completing the last build-up step', () => {
    let state = startSession(italianGame)
    state = submitMove(state, 'e4').state

    state = playLine(state, italianGame)

    state = playLine(state, italianGame)

    expect(state.phase).toBe('repeating')
    expect(state.repsDone).toBe(0)
    expect(state.expectedMoveIndex).toBe(0)
  })

  it('counts each full play-through as a repetition until done', () => {
    let state = startSession(italianGame)
    while (state.phase === 'building') {
      state = playLine(state, italianGame)
    }
    expect(state.phase).toBe('repeating')

    for (let i = 0; i < TARGET_REPS - 1; i += 1) {
      state = playLine(state, italianGame)
      expect(state.phase).toBe('repeating')
      expect(state.repsDone).toBe(i + 1)
    }

    state = playLine(state, italianGame)
    expect(state.phase).toBe('done')
    expect(state.repsDone).toBe(TARGET_REPS)
  })

  it('lenient wrong moves during repetitions do not reset rep counter', () => {
    let state = startSession(italianGame)
    while (state.phase === 'building') state = playLine(state, italianGame)
    state = playLine(state, italianGame)
    expect(state.repsDone).toBe(1)

    const wrong = submitMove(state, 'h4')
    expect(wrong.result).toBe('wrong')
    expect(wrong.state.repsDone).toBe(1)
  })

  it('exposes the next expected move after each correct submission', () => {
    let state = startSession(italianGame)
    expect(state.expectedSan).toBe('e4')

    state = submitMove(state, 'e4').state
    expect(state.currentStep).toBe(2)
    expect(state.expectedSan).toBe('e4')

    state = submitMove(state, 'e4').state
    expect(state.expectedSan).toBe('e5')
  })
})
