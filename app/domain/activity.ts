/**
 * Activity events capture the granular history of a learner's interaction with
 * a single line. They form the raw signal that a future spaced-repetition
 * scheduler (Anki-style SM-2 / FSRS) will consume to decide when the line
 * should resurface, even after it was already marked as mastered.
 *
 * The shape is intentionally append-only and self-describing: every record
 * carries enough context (topicId + lineId + at) to be replayed independently
 * of the in-memory state of the app.
 */
export type ActivityEventType =
  | 'session_started'
  | 'rep_completed'
  | 'mistake'
  | 'line_mastered'
  | 'help_requested'

export interface ActivityEvent {
  topicId: string
  lineId: string
  type: ActivityEventType
  at: number
  /** For rep_completed: how long the rep took, in milliseconds. */
  durationMs?: number
  /** For rep_completed: how many mistakes happened during this rep. */
  mistakeCount?: number
  /** For rep_completed: 1-based index of the rep within the session. */
  repIndex?: number
  /** For mistake: the SAN the engine expected. */
  expected?: string
  /** For mistake: the SAN the user actually played. */
  played?: string
}

export interface LineActivityStats {
  lineId: string
  sessionCount: number
  repCount: number
  mistakeCount: number
  helpCount: number
  lastSeenAt: number | null
  averageRepDurationMs: number | null
  averageMistakesPerRep: number | null
}

const emptyStats = (lineId: string): LineActivityStats => ({
  lineId,
  sessionCount: 0,
  repCount: 0,
  mistakeCount: 0,
  helpCount: 0,
  lastSeenAt: null,
  averageRepDurationMs: null,
  averageMistakesPerRep: null,
})

const mean = (values: number[]): number | null => {
  if (values.length === 0) return null
  let sum = 0
  for (const v of values) sum += v
  return sum / values.length
}

export const aggregateLineStats = (
  lineId: string,
  events: readonly ActivityEvent[],
): LineActivityStats => {
  const stats = emptyStats(lineId)
  const repDurations: number[] = []
  const repMistakeCounts: number[] = []

  for (const e of events) {
    if (e.lineId !== lineId) continue
    if (stats.lastSeenAt === null || e.at > stats.lastSeenAt) {
      stats.lastSeenAt = e.at
    }

    switch (e.type) {
      case 'session_started':
        stats.sessionCount += 1
        break
      case 'rep_completed':
        stats.repCount += 1
        if (typeof e.durationMs === 'number') repDurations.push(e.durationMs)
        if (typeof e.mistakeCount === 'number') {
          repMistakeCounts.push(e.mistakeCount)
        }
        break
      case 'mistake':
        stats.mistakeCount += 1
        break
      case 'help_requested':
        stats.helpCount += 1
        break
      case 'line_mastered':
        // Encoded in LineProgress as well; here we only need the timestamp.
        break
    }
  }

  stats.averageRepDurationMs = mean(repDurations)
  stats.averageMistakesPerRep = mean(repMistakeCounts)
  return stats
}
