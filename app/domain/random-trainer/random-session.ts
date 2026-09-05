import type { LearnedNode, LearnedTree } from './learned-tree'
import {
  isTerminal,
  sideToMove,
  validContinuations,
} from './learned-tree'
import type { Line, Side } from '~/domain/types'

/**
 * Random Opening Trainer — session state machine (pure, no I/O).
 *
 * A round is built around one randomly chosen **target line** (the line the
 * UI calls out at the top so the user knows what the app "wants"). The
 * computer plays its side of that target line while the user stays on it, so
 * the user can chase and finish the variation. If the user plays a valid
 * learned continuation that leaves the target line, that is acceptable — the
 * computer then continues with random learned moves — but the round is no
 * longer "on target". The round ends only when the current position has no
 * learned continuation left (end of a variation).
 *
 * Scoring (per user decision):
 *  - correct continuation without help: +1 point, streak +1
 *  - help requested: that move earns 0 points, streak resets
 *  - wrong move: 0 points, streak resets, counts as a mistake
 *  - round completed having followed the target line from the start with no
 *    mistakes: +5 bonus (`targetMet`). Help does not disqualify the bonus.
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
  /**
   * True when the round followed the target line from the start with no
   * mistakes → the +5 bonus applies. Help does not disqualify it.
   */
  targetMet: boolean
  /** 0 or +5, awarded when the target line was met. */
  bonus: number
  /** Sum of per-move points plus the bonus for this round. */
  pointsEarned: number
}

export interface RandomSessionState {
  node: LearnedNode
  userSide: Side
  phase: PracticePhase
  /** Display name of the randomly chosen target line this round. */
  targetName: string
  /** Stable id of the randomly chosen target line for this round. */
  targetId: string
  /** Full SAN list (both sides) of the target line. */
  targetSanMoves: string[]
  /** Index of the next expected SAN in `targetSanMoves`. */
  targetPly: number
  /** Whether the user is still following the target line without diverging. */
  onTarget: boolean
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
  /**
   * The randomly chosen target line drives the user's side and the computer's
   * on-target replies for this round.
   */
  line: Line
  /** Carry the persistent session totals into the new round. */
  from?: { score: number; streak: number; roundNumber: number }
}

export const startRound = (options: StartRoundOptions): RandomSessionState => {
  const from = options.from ?? { score: 0, streak: 0, roundNumber: 0 }
  const userSide: Side = options.line.userSide
  const node = options.tree.root
  const phase: PracticePhase =
    sideToMove(node) === userSide ? 'user' : 'computer'
  return {
    node,
    userSide,
    phase,
    targetName: options.line.fullName,
    targetId: options.line.id,
    targetSanMoves: options.line.sanMoves,
    targetPly: 0,
    onTarget: true,
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
  const targetMet = state.onTarget && state.roundMistakes === 0
  const bonus = targetMet ? PERFECT_ROUND_BONUS : 0
  const lastRound: PracticeRoundSummary = {
    roundNumber: state.roundNumber,
    moves: state.roundMoves,
    mistakes: state.roundMistakes,
    helpUsed: state.roundHelpUsed,
    targetMet,
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

  // Track adherence to the target line. A correct-but-off-target move (or any
  // divergence) permanently drops the round off target, forfeiting the bonus.
  let { targetPly, onTarget } = state
  if (onTarget) {
    if (state.targetSanMoves[targetPly] === san) {
      targetPly += 1
    } else {
      onTarget = false
    }
  }

  if (isTerminal(child)) {
    const completed = { ...state, node: child, playedSans, targetPly, onTarget }
    return completeRound(completed)
  }
  // The user finished the chosen target line on-target: award the bonus now.
  // This ends the round even when the merged tree continues (the target line
  // is a strict prefix of a longer variation) — otherwise the user would be
  // stranded with no on-target move to play.
  if (onTarget && targetPly >= state.targetSanMoves.length) {
    return completeRound({ ...state, node: child, playedSans, targetPly, onTarget })
  }
  const phase: PracticePhase =
    sideToMove(child) === state.userSide ? 'user' : 'computer'
  return {
    ...state,
    node: child,
    playedSans,
    targetPly,
    onTarget,
    phase,
    helpPending: false,
  }
}

/** The SAN the computer plays next, or null when it is not the computer's turn. */
export const pickComputerSan = (
  state: RandomSessionState,
  rng: () => number = Math.random,
): string | null => {
  if (state.phase !== 'computer') return null
  // While on target the computer plays the target line's next move so the
  // user can follow and finish the chosen variation.
  if (state.onTarget) return state.targetSanMoves[state.targetPly] ?? null
  return pickRandomEdge(state.node, rng)
}

/**
 * Advance the computer by one continuation: the target line's next move while
 * on target, otherwise a random learned continuation. Returns the next state
 * (unchanged when it is the user's turn or the round is already done).
 */
export const computerMove = (
  state: RandomSessionState,
  rng: () => number = Math.random,
): RandomSessionState => {
  if (state.phase !== 'computer') return state
  const san = pickComputerSan(state, rng)
  if (!san) return completeRound(state)
  if (!state.node.edges.has(san)) {
    // Only reachable if the target data is inconsistent with the tree; never
    // award the on-target bonus under a broken continuation.
    return completeRound({ ...state, onTarget: false })
  }
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
