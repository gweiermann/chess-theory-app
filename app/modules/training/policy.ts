import type { OutcomeGrade } from '../shared'
import type { Phase } from './public'

export const DEFAULT_TIMING = Object.freeze({ opponentMs: 900, resetMs: 650 })
export function evaluateMove(input: {
  san: string
  permitted: readonly string[]
  phase: Phase
  attempt: number
  helped: boolean
  suggested: string | null
  newMaterial: boolean
}):
  | { accepted: true; grade: OutcomeGrade }
  | { accepted: false; reveal: boolean } {
  if (!input.permitted.includes(input.san))
    return { accepted: false, reveal: input.attempt >= 1 }
  const grade: OutcomeGrade =
    input.phase === 'guided'
      ? 'new'
      : input.helped
        ? 'hinted'
        : input.suggested === input.san
          ? 'suggested'
          : input.attempt > 0
            ? 'retried'
            : input.newMaterial
              ? 'new'
              : 'recalled'
  return { accepted: true, grade }
}
