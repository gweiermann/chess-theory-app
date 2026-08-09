import type { LearnedNode, LearnedTree } from './learned-tree'
import {
  isTerminal,
  sideToMove,
  validContinuations,
} from './learned-tree'
import type { Side } from '~/domain/types'

/**
 * Random Opening Trainer — session state machine (pure, no I/O).
 *
 * A round walks one path through the {@link LearnedTree}: the computer
 * auto-plays its side's moves (picking a random learned continuation each
 * turn), and the user must answer with a learned continuation. Multiple
 * continuations are correct as long as they remain inside the tree. A mistake
 * does not end the round — it shows the valid continuations and the user
 * picks one to carry on. The round ends only when the current position has no
 * learned continuation left (end of the variation).
 *
 * Scoring (per user decision):
 *  - correct continuation without help: +1 point, streak +1
 *  - help requested: that move earns 0 points, streak resets
 *  - wrong move: 0 points, streak resets, counts as a mistake
 *  - round completed with 0 mistakes: +5 bonus
 */

export type PracticePhase = 'computer' | 'user' | 'round-complete'

export type UserOutcome =
  | { kind: 'correct'; san: string; points: number; streak: number }
  | { kind: 'wrong'; san: string; continuations: string[]; streak: number }

export interface PracticeRoundSummary {
  roundNumber: number
  /** Number of valid continuations the user played this round. */
  moves: number
  mistakes: number
  helpUsed: boolean
  /** 0 or +5, awarded when the round had no mistakes. */
  bonus: number
  /** Sum of per-move points plus the bonus for this round. */
  pointsEarned: number
}

export interface RandomSessionState {
  node: LearnedNode
  userSide: Side
  phase: PracticePhase
  /** SANs played from the start of the current round (display / replay). */
  playedSans: string[]
  score: number
  streak: number
  roundNumber: number
  roundMoves: number
  roundMistakes: number
  roundHelpUsed: boolean
  roundPoints: number
  /** Set when the user pressed Hilfe for the current user turn (next move = helped). */
  helpPending: boolean
  lastOutcome: UserOutcome | null
  lastRound: PracticeRoundSummary | null
}

export const CORRECT_POINTS = 1
export const PERFECT_ROUND_BONUS = 5

export interface StartRoundOptions {
  tree: LearnedTree
  userSide: Side
  /** Random sources so callers can seed deterministic tests (0..1 each). */
  rng?: () => number
  /** Carry the persistent session totals into the new round. */
  from?: { score: number; streak: number; roundNumber: number }
}

export const startRound = (options: StartRoundOptions): RandomSessionState => {
  const from = options.from ?? { score: 0, streak: 0, roundNumber: 0 }
  const node = options.tree.root
  const phase: PracticePhase =
    sideToMove(node) === options.userSide ? 'user' : 'computer'
  return {
    node,
    userSide: options.userSide,
    phase,
    playedSans: [],
    score: from.score,
    streak: from.streak,
    roundNumber: from.roundNumber + 1,
    roundMoves: 0,
    roundMistakes: 0,
    roundHelpUsed: false,
    roundPoints: 0,
    helpPending: false,
    lastOutcome: null,
    lastRound: null,
  }
}

const pickRandomEdge = (
  node: LearnedNode,
  rng: () => number,
): string | null => {
  const keys = [...node.edges.keys()]
  if (keys.length === 0) return null
  const idx = Math.min(keys.length - 1, Math.floor(rng() * keys.length))
  return keys[idx] ?? null
}

const completeRound = (state: RandomSessionState): RandomSessionState => {
  const bonus = state.roundMistakes === 0 ? PERFECT_ROUND_BONUS : 0
  const lastRound: PracticeRoundSummary = {
    roundNumber: state.roundNumber,
    moves: state.roundMoves,
    mistakes: state.roundMistakes,
    helpUsed: state.roundHelpUsed,
    bonus,
    pointsEarned: state.roundPoints + bonus,
  }
  return {
    ...state,
    phase: 'round-complete',
    score: state.score + bonus,
    lastRound,
    lastOutcome: null,
  }
}

const advanceTo = (state: RandomSessionState, san: string): RandomSessionState => {
  const child = state.node.edges.get(san)
  if (!child) return state
  const playedSans = [...state.playedSans, san]
  if (isTerminal(child)) {
    return completeRound({ ...state, node: child, playedSans })
  }
  const phase: PracticePhase =
    sideToMove(child) === state.userSide ? 'user' : 'computer'
  return {
    ...state,
    node: child,
    playedSans,
    phase,
    helpPending: false,
  }
}

/** The SAN the computer will play next, or null when it is not the computer's turn. */
export const pickComputerSan = (
  state: RandomSessionState,
  rng: () => number = Math.random,
): string | null =>
  state.phase === 'computer' ? pickRandomEdge(state.node, rng) : null

/**
 * Advance the computer by one random learned continuation. Returns the next
 * state (unchanged when it is the user's turn or the round is already done).
 */
export const computerMove = (
  state: RandomSessionState,
  rng: () => number = Math.random,
): RandomSessionState => {
  if (state.phase !== 'computer') return state
  const san = pickComputerSan(state, rng)
  if (!san) return completeRound(state)
  return advanceTo(state, san)
}

/**
 * Record that the user requested Hilfe for the pending user turn. The next
 * continuation they play earns 0 points and resets the streak.
 */
export const markHelp = (state: RandomSessionState): RandomSessionState => {
  if (state.phase !== 'user') return state
  return { ...state, helpPending: true, roundHelpUsed: true }
}

export interface SubmitUserResult {
  state: RandomSessionState
  outcome: UserOutcome
}

/**
 * Validate the user's continuation against the current node's learned edges.
 * A wrong move does not advance the round; it records a mistake (streak reset)
 * and leaves the user to pick a valid continuation to continue.
 */
export const submitUserMove = (
  state: RandomSessionState,
  san: string,
): SubmitUserResult => {
  if (!state.node.edges.has(san)) {
    const outcome: UserOutcome = {
      kind: 'wrong',
      san,
      continuations: validContinuations(state.node),
      streak: 0,
    }
    return {
      state: {
        ...state,
        streak: 0,
        roundMistakes: state.roundMistakes + 1,
        helpPending: false,
        lastOutcome: outcome,
      },
      outcome,
    }
  }

  const helped = state.helpPending
  const points = helped ? 0 : CORRECT_POINTS
  const streak = helped ? 0 : state.streak + 1
  const outcome: UserOutcome = { kind: 'correct', san, points, streak }

  let next: RandomSessionState = {
    ...state,
    score: state.score + points,
    streak,
    roundMoves: state.roundMoves + 1,
    roundPoints: state.roundPoints + points,
    helpPending: false,
    lastOutcome: outcome,
  }
  next = advanceTo(next, san)
  return { state: next, outcome }
}

/** The valid continuations the user may currently play (for the hint list). */
export const availableContinuations = (
  state: RandomSessionState,
): string[] => (state.phase === 'user' ? validContinuations(state.node) : [])
