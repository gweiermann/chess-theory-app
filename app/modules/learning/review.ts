import type { LearningOutcome, ReviewMemory } from '../shared'

// Review policy is independent of database format and can be replaced without changing repository callers.
const POLICY = Object.freeze({
  dayMs: 86400000,
  maximumDays: 30,
  growthFactor: 2,
  assistedDays: 1,
})

export function nextMemory(
  previous: ReviewMemory | undefined,
  event: LearningOutcome,
): ReviewMemory {
  const assisted =
    event.kind !== 'exposure' &&
    (['hinted', 'suggested'].includes(event.grade) ||
      (event.grade === 'new' && event.mode === 'guided'))
  const attempts = (previous?.attempts ?? 0) + 1
  const days =
    event.grade === 'recalled' && !event.mistakes
      ? Math.min(
          POLICY.maximumDays,
          POLICY.growthFactor ** Math.min(attempts - 1, 5),
        )
      : POLICY.assistedDays

  return {
    attempts,
    mistakes: (previous?.mistakes ?? 0) + event.mistakes,
    assisted: (previous?.assisted ?? 0) + Number(assisted),
    lastSeenAt: event.at,
    dueAt: Math.min(8.64e15, event.at + days * POLICY.dayMs),
  }
}
