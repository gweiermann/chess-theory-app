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

const giuocoPiano: Line = {
  id: 'C53-italian-giuoco-piano',
  eco: 'C53',
  fullName: 'Italian Game: Giuoco Piano',
  pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3',
  sanMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3'],
  userSide: 'white',
}

describe('session with a parent prefix', () => {
  it('starts in intro phase when a prefix is configured', () => {
    const state = startSession(giuocoPiano, 5)
    expect(state.phase).toBe('intro')
    expect(state.prefixPlies).toBe(5)
    expect(state.expectedMoveIndex).toBe(0)
    expect(state.expectedSan).toBe('e4')
    // Only the extension moves count towards totalSteps – drilling the
    // parent again would be redundant.
    expect(state.totalSteps).toBe(1)
  })

  it('transitions from intro to building once the cursor crosses the prefix', () => {
    let state = startSession(giuocoPiano, 5)
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']) {
      state = submitMove(state, san).state
    }
    expect(state.phase).toBe('building')
    expect(state.currentStep).toBe(1)
    expect(state.expectedMoveIndex).toBe(5)
    expect(state.expectedSan).toBe('Bc5')
  })

  it('rejects a wrong intro move without advancing the cursor', () => {
    const state = startSession(giuocoPiano, 5)
    const wrong = submitMove(state, 'd4')
    expect(wrong.result).toBe('wrong')
    expect(wrong.state.expectedMoveIndex).toBe(0)
    expect(wrong.state.phase).toBe('intro')
  })

  it('resets repetitions back to the prefix, not the empty board', () => {
    let state = startSession(giuocoPiano, 5)
    for (const san of giuocoPiano.sanMoves) {
      state = submitMove(state, san).state
    }
    expect(state.phase).toBe('repeating')
    expect(state.expectedMoveIndex).toBe(5)
    expect(state.expectedSan).toBe('Bc5')

    state = submitMove(state, 'Bc5').state
    state = submitMove(state, 'c3').state
    expect(state.repsDone).toBe(1)
    expect(state.expectedMoveIndex).toBe(5)
  })

  it('skips the intro entirely when no prefix is provided', () => {
    const state = startSession(giuocoPiano, 0)
    expect(state.phase).toBe('building')
    expect(state.prefixPlies).toBe(0)
    expect(state.totalSteps).toBe(4)
  })

  it('clamps unreasonable prefixes to zero so we never get stuck', () => {
    const state = startSession(giuocoPiano, giuocoPiano.sanMoves.length + 1)
    expect(state.prefixPlies).toBe(0)
    expect(state.phase).toBe('building')
  })

  it('skipIntro jumps directly into building at the prefix position', () => {
    const state = startSession(giuocoPiano, 5, { skipIntro: true })
    expect(state.phase).toBe('building')
    expect(state.prefixPlies).toBe(5)
    expect(state.currentStep).toBe(1)
    expect(state.expectedMoveIndex).toBe(5)
    expect(state.expectedSan).toBe('Bc5')
    expect(state.totalSteps).toBe(1)
  })

  it('skipIntro has no effect when no prefix is configured', () => {
    const state = startSession(giuocoPiano, 0, { skipIntro: true })
    expect(state.phase).toBe('building')
    expect(state.prefixPlies).toBe(0)
    expect(state.expectedMoveIndex).toBe(0)
  })
})
