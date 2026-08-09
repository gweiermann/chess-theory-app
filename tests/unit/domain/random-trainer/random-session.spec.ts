import { describe, expect, it } from 'vitest'
import { buildLearnedTree } from '~/domain/random-trainer/learned-tree'
import {
  availableContinuations,
  computerMove,
  CORRECT_POINTS,
  markHelp,
  PERFECT_ROUND_BONUS,
  pickComputerSan,
  startRound,
  submitUserMove,
  type RandomSessionState,
} from '~/domain/random-trainer/random-session'
import type { Line } from '~/domain/types'

const line = (sanMoves: string[], userSide: Line['userSide'] = 'white'): Line => ({
  id: 'line',
  eco: 'C23',
  fullName: 'test line',
  pgn: '',
  sanMoves,
  userSide,
})

const RNG_ZERO = () => 0

const whiteRound = (sans: string[]): RandomSessionState =>
  startRound({ tree: buildLearnedTree([line(sans, 'white')]), userSide: 'white' })

const playUserToTerminal = (state: RandomSessionState, sans: string[]): RandomSessionState => {
  let s = state
  for (const san of sans) {
    const res = submitUserMove(s, san)
    s = res.state
    s = computerMove(s, RNG_ZERO)
  }
  return s
}

describe('startRound', () => {
  it('starts in the user phase when the user owns the side to move', () => {
    const s = whiteRound(['e4', 'e5'])
    expect(s.phase).toBe('user')
    expect(s.playedSans).toEqual([])
    expect(s.roundNumber).toBe(1)
  })

  it('starts in the computer phase when it is the computer to move', () => {
    const s = startRound({
      tree: buildLearnedTree([line(['e4', 'e5'], 'black')]),
      userSide: 'black', // e4 is white's ply → computer moves first
    })
    expect(s.phase).toBe('computer')
    expect(s.roundNumber).toBe(1)
  })

  it('carries session totals and increments the round number', () => {
    const s = startRound({
      tree: buildLearnedTree([line(['e4', 'e5'])]),
      userSide: 'white',
      from: { score: 12, streak: 4, roundNumber: 3 },
    })
    expect(s.score).toBe(12)
    expect(s.streak).toBe(4)
    expect(s.roundNumber).toBe(4)
    expect(s.roundMistakes).toBe(0)
    expect(s.roundPoints).toBe(0)
  })
})

describe('submitUserMove', () => {
  it('a correct move earns a point and advances the streak', () => {
    const s = whiteRound(['e4', 'e5', 'Bc4'])
    const { state, outcome } = submitUserMove(s, 'e4')
    expect(outcome).toEqual({ kind: 'correct', san: 'e4', points: CORRECT_POINTS, streak: 1 })
    expect(state.score).toBe(1)
    expect(state.streak).toBe(1)
    expect(state.roundMoves).toBe(1)
    expect(state.roundPoints).toBe(1)
    expect(state.phase).toBe('computer') // black to move
  })

  it('does not advance the round or award points on a wrong move', () => {
    const s = whiteRound(['e4', 'e5'])
    const { state, outcome } = submitUserMove(s, 'd4')
    expect(outcome.kind).toBe('wrong')
    if (outcome.kind !== 'wrong') return
    expect(outcome.streak).toBe(0)
    expect(state.phase).toBe('user') // round continues
    expect(state.playedSans).toEqual([])
    expect(state.score).toBe(0)
    expect(state.roundMistakes).toBe(1)
    expect(state.streak).toBe(0)
  })

  it('reports all valid continuations on a wrong move', () => {
    const tree = buildLearnedTree([
      line(['e4', 'e5'], 'white'),
      line(['d4', 'd5'], 'white'),
    ])
    const s = startRound({ tree, userSide: 'white' })
    const { outcome } = submitUserMove(s, 'f4')
    expect(outcome.kind).toBe('wrong')
    if (outcome.kind !== 'wrong') return
    expect(outcome.continuations).toEqual(['e4', 'd4'])
  })

  it('lets the round continue to completion after a mistake (withheld bonus)', () => {
    const s = whiteRound(['e4', 'e5', 'Bc4'])
    const afterWrong = submitUserMove(s, 'd3').state
    expect(afterWrong.phase).toBe('user')
    const done = playUserToTerminal(afterWrong, ['e4', 'Bc4'])
    expect(done.phase).toBe('round-complete')
    expect(done.roundMistakes).toBe(1)
    expect(done.lastRound?.bonus).toBe(0)
    expect(done.lastRound?.pointsEarned).toBe(2) // e4+Bc4, no bonus
    expect(done.score).toBe(2)
  })

  it('finishes a clean round with the +5 bonus', () => {
    const s = whiteRound(['e4', 'e5', 'Bc4'])
    const done = playUserToTerminal(s, ['e4', 'Bc4'])
    expect(done.phase).toBe('round-complete')
    expect(done.roundMistakes).toBe(0)
    expect(done.lastRound?.bonus).toBe(PERFECT_ROUND_BONUS)
    expect(done.lastRound?.pointsEarned).toBe(7) // 2 moves + 5 bonus
    expect(done.score).toBe(7)
    expect(done.lastRound?.helpUsed).toBe(false)
  })
})

describe('markHelp', () => {
  it('flags the next move as helped and marks the round', () => {
    const s = whiteRound(['e4', 'e5', 'Nf3'])
    const helped = markHelp(s)
    expect(helped.helpPending).toBe(true)
    expect(helped.roundHelpUsed).toBe(true)
  })

  it('is a no-op outside the user phase', () => {
    const tree = buildLearnedTree([line(['e4', 'e5'], 'black')])
    const s = startRound({ tree, userSide: 'black' }) // computer phase
    expect(markHelp(s)).toBe(s)
  })

  it('a helped move earns 0 points and resets the streak', () => {
    const s = markHelp(whiteRound(['e4', 'e5']))
    const { state, outcome } = submitUserMove(s, 'e4')
    expect(outcome).toEqual({ kind: 'correct', san: 'e4', points: 0, streak: 0 })
    expect(state.roundPoints).toBe(0)
    expect(state.roundMoves).toBe(1)
    expect(state.helpPending).toBe(false)
  })
})

describe('computerMove', () => {
  it('picks a random learned continuation and hands the turn to the user', () => {
    const s = whiteRound(['e4', 'e5', 'Nf3'])
    const afterUser = submitUserMove(s, 'e4').state // phase: computer
    expect(afterUser.phase).toBe('computer')
    const afterComputer = computerMove(afterUser, RNG_ZERO)
    expect(afterComputer.phase).toBe('user')
    expect(afterComputer.playedSans).toEqual(['e4', 'e5'])
    expect(afterComputer.score).toBe(1) // untouched by the computer
    expect(afterComputer.roundMoves).toBe(1)
  })

  it('is a no-op when it is not the computer turn', () => {
    const s = whiteRound(['e4', 'e5']) // user phase
    expect(computerMove(s, RNG_ZERO)).toBe(s)
  })

  it('does not re-award the bonus after the round is complete', () => {
    const s = whiteRound(['e4', 'e5', 'Bc4'])
    const done = playUserToTerminal(s, ['e4', 'Bc4'])
    expect(done.score).toBe(7)
    const after = computerMove(done, RNG_ZERO)
    expect(after).toBe(done)
    expect(after.score).toBe(7)
    expect(after.lastRound?.pointsEarned).toBe(7)
  })

  it('pickComputerSan returns null outside the computer phase', () => {
    const s = whiteRound(['e4', 'e5'])
    expect(pickComputerSan(s, RNG_ZERO)).toBeNull()
    const afterUser = submitUserMove(s, 'e4').state
    expect(pickComputerSan(afterUser, RNG_ZERO)).toBe('e5')
  })
})

describe('availableContinuations', () => {
  it('only lists continuations during the user turn', () => {
    const s = whiteRound(['e4', 'e5', 'Bc4'])
    expect(availableContinuations(s)).toEqual(['e4'])
    const afterUser = submitUserMove(s, 'e4').state // computer phase
    expect(availableContinuations(afterUser)).toEqual([])
  })
})
