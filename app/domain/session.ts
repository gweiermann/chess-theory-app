import type { Line } from './types'

export const TARGET_REPS = 5

export type SessionPhase = 'building' | 'repeating' | 'done'

export interface SessionState {
  line: Line
  phase: SessionPhase
  currentStep: number
  expectedMoveIndex: number
  repsDone: number
  expectedSan: string | null
  totalSteps: number
}

export type SubmitResult =
  | { result: 'correct'; state: SessionState }
  | { result: 'wrong'; expected: string; state: SessionState }

const isUserMoveIndex = (line: Line, index: number): boolean => {
  if (index < 0 || index >= line.sanMoves.length) return false
  const ply = index % 2 === 0 ? 'white' : 'black'
  return ply === line.userSide
}

const userMoveIndices = (line: Line): number[] => {
  const indices: number[] = []
  for (let i = 0; i < line.sanMoves.length; i += 1) {
    if (isUserMoveIndex(line, i)) indices.push(i)
  }
  return indices
}

const lastPlyForStep = (line: Line, step: number): number => {
  const indices = userMoveIndices(line)
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

export const startSession = (line: Line): SessionState => {
  const totalSteps = userMoveIndices(line).length
  const phase: SessionPhase =
    line.sanMoves.length === 0 || totalSteps === 0 ? 'done' : 'building'

  return {
    line,
    phase,
    currentStep: 1,
    expectedMoveIndex: 0,
    repsDone: 0,
    totalSteps,
    expectedSan: phase === 'done' ? null : (line.sanMoves[0] ?? null),
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

  if (state.phase === 'building') {
    const stepEndPly = lastPlyForStep(state.line, state.currentStep)
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
          expectedMoveIndex: 0,
        }),
      }
    }

    if (nextIndex >= totalMoves) {
      return {
        result: 'correct',
        state: cloneWith(state, {
          phase: 'repeating',
          expectedMoveIndex: 0,
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
      expectedMoveIndex: 0,
      repsDone: newReps,
    }),
  }
}

export const repeatFromStart = (state: SessionState): SessionState =>
  cloneWith(state, { expectedMoveIndex: 0 })

export const revealNext = (state: SessionState): string | null =>
  state.expectedSan

/**
 * True when the engine is currently waiting on the user move that defines the
 * current step (the "new" move that was just unlocked). Used to drive the
 * board hint that demonstrates the move on the first encounter.
 */
export const isNewStepMove = (state: SessionState): boolean => {
  if (state.phase !== 'building') return false
  return state.expectedMoveIndex === lastPlyForStep(state.line, state.currentStep)
}
