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

const whiteRound = (sans: string[]): RandomSessionState => {
  const l = line(sans, 'white')
  return startRound({ tree: buildLearnedTree([l]), line: l })
}

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
    const l = line(['e4', 'e5'], 'black')
    const s = startRound({
      tree: buildLearnedTree([l]),
      line: l, // e4 is white's ply → computer moves first
    })
    expect(s.phase).toBe('computer')
    expect(s.roundNumber).toBe(1)
  })

  it('carries session totals and increments the round number', () => {
    const l = line(['e4', 'e5'])
    const s = startRound({
      tree: buildLearnedTree([l]),
      line: l,
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
    const s = startRound({ tree, line: line(['e4', 'e5'], 'white') })
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
    const l = line(['e4', 'e5'], 'black')
    const s = startRound({ tree: buildLearnedTree([l]), line: l }) // computer phase
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

describe('target line', () => {
  it('exposes the chosen target line for the top "Ziel" label', () => {
    const l = line(['e4', 'e5', 'Bc4'], 'white')
    l.fullName = 'Italienisch'
    const s = startRound({ tree: buildLearnedTree([l]), line: l })
    expect(s.targetName).toBe('Italienisch')
    expect(s.targetSanMoves).toEqual(['e4', 'e5', 'Bc4'])
    expect(s.userSide).toBe('white')
    expect(s.onTarget).toBe(true)
    expect(s.targetPly).toBe(0)
  })

  it('computer follows the target line while on target, ignoring rng', () => {
    const targetLine = line(['e4', 'c5'], 'white') // black has two learned replies
    const alt = line(['e4', 'e6'], 'white')
    const tree = buildLearnedTree([targetLine, alt])
    const s = startRound({ tree, line: targetLine })
    const afterUser = submitUserMove(s, 'e4').state // computer to move
    // rng that would pick the *last* edge (e6); on-target it must still play c5.
    const afterComputer = computerMove(afterUser, () => 0.9)
    expect(afterComputer.playedSans).toEqual(['e4', 'c5'])
    expect(afterComputer.onTarget).toBe(true)
    expect(afterComputer.targetPly).toBe(2)
  })

  it('a valid off-target move is accepted but forfeits the +5 bonus', () => {
    const targetLine = line(['e4', 'e5', 'Bc4', 'Bc5'], 'white')
    const alt = line(['e4', 'e5', 'Nf3', 'Nc6'], 'white')
    const tree = buildLearnedTree([targetLine, alt])
    let s = startRound({ tree, line: targetLine })

    s = submitUserMove(s, 'e4').state // on target, ply → 1
    s = computerMove(s, RNG_ZERO) // e5, user turn
    expect(s.onTarget).toBe(true)

    s = submitUserMove(s, 'Nf3').state // valid learned, but off target
    expect(s.onTarget).toBe(false)
    expect(s.phase).toBe('computer')

    s = computerMove(s, RNG_ZERO) // random continuation on the alt branch
    expect(s.phase).toBe('round-complete')
    expect(s.roundMistakes).toBe(0)
    expect(s.lastRound?.targetMet).toBe(false)
    expect(s.lastRound?.bonus).toBe(0)
    expect(s.lastRound?.pointsEarned).toBe(2) // e4 + Nf3, no bonus
    expect(s.score).toBe(2)
  })

  it('help does not disqualify the target bonus (only mistakes/divergence do)', () => {
    let s = markHelp(whiteRound(['e4', 'e5', 'Bc4']))
    s = submitUserMove(s, 'e4').state // helped, on target
    s = computerMove(s, RNG_ZERO) // e5
    s = markHelp(s)
    s = submitUserMove(s, 'Bc4').state // helped, completes target line
    expect(s.phase).toBe('round-complete')
    expect(s.roundMistakes).toBe(0)
    expect(s.lastRound?.targetMet).toBe(true)
    expect(s.lastRound?.helpUsed).toBe(true)
    expect(s.lastRound?.bonus).toBe(PERFECT_ROUND_BONUS)
    expect(s.lastRound?.pointsEarned).toBe(PERFECT_ROUND_BONUS)
    expect(s.score).toBe(PERFECT_ROUND_BONUS)
  })

  it('ends the round with the bonus when the target line is a strict prefix of a longer variation', () => {
    const targetLine = line(['e4', 'e5'], 'white') // 2-ply target, tree continues
    const longer = line(['e4', 'e5', 'Nf3'], 'white')
    const tree = buildLearnedTree([targetLine, longer])
    let s = startRound({ tree, line: targetLine })
    s = submitUserMove(s, 'e4').state
    s = computerMove(s, RNG_ZERO) // computer e5 completes the target line
    expect(s.phase).toBe('round-complete')
    expect(s.lastRound?.targetMet).toBe(true)
    expect(s.lastRound?.bonus).toBe(PERFECT_ROUND_BONUS)
    expect(s.lastRound?.pointsEarned).toBe(1 + PERFECT_ROUND_BONUS)
    expect(s.score).toBe(1 + PERFECT_ROUND_BONUS)
  })

  it('a mistake on the target line still withholds the bonus', () => {
    const s = whiteRound(['e4', 'e5', 'Bc4'])
    const afterWrong = submitUserMove(s, 'd3').state // mistake
    const done = playUserToTerminal(afterWrong, ['e4', 'Bc4'])
    expect(done.onTarget).toBe(true) // stayed on target, but not flawless
    expect(done.lastRound?.targetMet).toBe(false)
    expect(done.lastRound?.bonus).toBe(0)
  })
})
