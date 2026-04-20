import type { Line } from './types'

export const TARGET_REPS = 5

export type SessionPhase = 'intro' | 'building' | 'repeating' | 'done'

export interface SessionState {
  line: Line
  phase: SessionPhase
  currentStep: number
  expectedMoveIndex: number
  repsDone: number
  expectedSan: string | null
  totalSteps: number
  /**
   * Number of half-moves at the start of `line.sanMoves` that are considered
   * a "prefix" – these plies were already mastered through a parent line and
   * should be treated as setup. The very first time we encounter the line
   * the user plays through them in the `intro` phase; every subsequent reset
   * (step-switch, rep loop) starts from this position rather than from the
   * empty board.
   */
  prefixPlies: number
}

export type SubmitResult =
  | { result: 'correct'; state: SessionState }
  | { result: 'wrong'; expected: string; state: SessionState }

const isUserMoveIndex = (line: Line, index: number): boolean => {
  if (index < 0 || index >= line.sanMoves.length) return false
  const ply = index % 2 === 0 ? 'white' : 'black'
  return ply === line.userSide
}

/**
 * Indices of user-side half-moves at or after {@link fromIdx}. When a prefix
 * is configured we exclude the setup plies from step counting entirely so
 * the user only "unlocks" moves that belong to the extension.
 */
const userMoveIndices = (line: Line, fromIdx = 0): number[] => {
  const indices: number[] = []
  for (let i = fromIdx; i < line.sanMoves.length; i += 1) {
    if (isUserMoveIndex(line, i)) indices.push(i)
  }
  return indices
}

const lastPlyForStep = (
  line: Line,
  step: number,
  prefixPlies: number,
): number => {
  const indices = userMoveIndices(line, prefixPlies)
  const userMoveIdx = Math.min(Math.max(step, 1), indices.length) - 1
  return indices[userMoveIdx] ?? -1
}

const expectedSanFor = (
  line: Line,
  phase: SessionPhase,
  index: number,
): string | null => {
  if (phase === 'done') return null
  return line.sanMoves[index] ?? null
}

const recompute = (state: SessionState): SessionState => ({
  ...state,
  expectedSan: expectedSanFor(state.line, state.phase, state.expectedMoveIndex),
})

const cloneWith = (
  state: SessionState,
  overrides: Partial<SessionState>,
): SessionState => recompute({ ...state, ...overrides })

const clampPrefix = (line: Line, prefixPlies: number): number => {
  if (!Number.isFinite(prefixPlies) || prefixPlies <= 0) return 0
  if (prefixPlies >= line.sanMoves.length) return 0
  return Math.floor(prefixPlies)
}

export interface StartSessionOptions {
  /**
   * Skip the intro walkthrough and jump directly into `building` with the
   * cursor already past the prefix. Used when the parent has been drilled
   * (either as a real mastered sibling or as the implicit topic-first-move
   * parent) and the prefix should just be auto-played onto the board
   * instead of being re-typed by the user.
   */
  skipIntro?: boolean
}

export const startSession = (
  line: Line,
  prefixPlies = 0,
  options: StartSessionOptions = {},
): SessionState => {
  const safePrefix = clampPrefix(line, prefixPlies)
  const totalSteps = userMoveIndices(line, safePrefix).length
  const hasWork = line.sanMoves.length > 0 && totalSteps > 0
  const wantsIntro = safePrefix > 0 && !options.skipIntro
  const phase: SessionPhase = !hasWork
    ? 'done'
    : wantsIntro
      ? 'intro'
      : 'building'

  const startIndex = phase === 'done'
    ? line.sanMoves.length
    : wantsIntro
      ? 0
      : safePrefix

  return {
    line,
    phase,
    currentStep: 1,
    expectedMoveIndex: startIndex,
    repsDone: 0,
    totalSteps,
    prefixPlies: safePrefix,
    expectedSan: phase === 'done' ? null : (line.sanMoves[startIndex] ?? null),
  }
}

export const submitMove = (
  state: SessionState,
  san: string,
): SubmitResult => {
  if (state.phase === 'done') {
    return { result: 'correct', state }
  }

  const expected = expectedSanFor(state.line, state.phase, state.expectedMoveIndex)
  if (expected === null) {
    return { result: 'correct', state }
  }

  if (san !== expected) {
    return { result: 'wrong', expected, state: recompute(state) }
  }

  const totalMoves = state.line.sanMoves.length
  const nextIndex = state.expectedMoveIndex + 1

  if (state.phase === 'intro') {
    // Still replaying the parent's prefix. Once the cursor reaches the first
    // ply of the extension we flip into the building phase – the user has
    // now reached the parent position and can start learning new moves.
    if (nextIndex >= state.prefixPlies) {
      return {
        result: 'correct',
        state: cloneWith(state, {
          phase: 'building',
          currentStep: 1,
          expectedMoveIndex: state.prefixPlies,
        }),
      }
    }
    return {
      result: 'correct',
      state: cloneWith(state, { expectedMoveIndex: nextIndex }),
    }
  }

  if (state.phase === 'building') {
    const stepEndPly = lastPlyForStep(state.line, state.currentStep, state.prefixPlies)
    const stepFinished = nextIndex > stepEndPly

    if (!stepFinished) {
      return {
        result: 'correct',
        state: cloneWith(state, { expectedMoveIndex: nextIndex }),
      }
    }

    const isLastStep = state.currentStep >= state.totalSteps
    if (!isLastStep) {
      return {
        result: 'correct',
        state: cloneWith(state, {
          currentStep: state.currentStep + 1,
          expectedMoveIndex: state.prefixPlies,
        }),
      }
    }

    if (nextIndex >= totalMoves) {
      return {
        result: 'correct',
        state: cloneWith(state, {
          phase: 'repeating',
          expectedMoveIndex: state.prefixPlies,
          repsDone: 0,
        }),
      }
    }

    return {
      result: 'correct',
      state: cloneWith(state, { expectedMoveIndex: nextIndex }),
    }
  }

  const repFinished = nextIndex >= totalMoves
  if (!repFinished) {
    return {
      result: 'correct',
      state: cloneWith(state, { expectedMoveIndex: nextIndex }),
    }
  }

  const newReps = state.repsDone + 1
  if (newReps >= TARGET_REPS) {
    return {
      result: 'correct',
      state: cloneWith(state, {
        phase: 'done',
        expectedMoveIndex: totalMoves,
        repsDone: newReps,
      }),
    }
  }

  return {
    result: 'correct',
    state: cloneWith(state, {
      expectedMoveIndex: state.prefixPlies,
      repsDone: newReps,
    }),
  }
}

export const repeatFromStart = (state: SessionState): SessionState =>
  cloneWith(state, { expectedMoveIndex: state.prefixPlies })

export const revealNext = (state: SessionState): string | null =>
  state.expectedSan

/**
 * True when the engine is currently waiting on the user move that defines the
 * current step (the "new" move that was just unlocked). Used to drive the
 * board hint that demonstrates the move on the first encounter. Intro plies
 * are never "new" since the user has already mastered them via the parent.
 */
export const isNewStepMove = (state: SessionState): boolean => {
  if (state.phase !== 'building') return false
  return state.expectedMoveIndex === lastPlyForStep(
    state.line,
    state.currentStep,
    state.prefixPlies,
  )
}
