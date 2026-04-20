import { describe, expect, it } from 'vitest'
import { aggregateLineStats, type ActivityEvent } from '~/domain/activity'

const ev = (
  type: ActivityEvent['type'],
  at: number,
  extra: Partial<ActivityEvent> = {},
): ActivityEvent => ({
  topicId: 'e4',
  lineId: 'l',
  type,
  at,
  ...extra,
})

describe('aggregateLineStats', () => {
  it('returns zeroed stats for an empty event log', () => {
    expect(aggregateLineStats('l', [])).toEqual({
      lineId: 'l',
      sessionCount: 0,
      repCount: 0,
      mistakeCount: 0,
      helpCount: 0,
      lastSeenAt: null,
      averageRepDurationMs: null,
      averageMistakesPerRep: null,
    })
  })

  it('counts sessions, reps, mistakes and help requests', () => {
    const stats = aggregateLineStats('l', [
      ev('session_started', 1),
      ev('mistake', 2, { expected: 'e4', played: 'e5' }),
      ev('rep_completed', 3, { repIndex: 1, durationMs: 4_000, mistakeCount: 1 }),
      ev('help_requested', 4),
      ev('rep_completed', 5, { repIndex: 2, durationMs: 6_000, mistakeCount: 0 }),
      ev('line_mastered', 6),
      ev('session_started', 100),
    ])

    expect(stats.sessionCount).toBe(2)
    expect(stats.repCount).toBe(2)
    expect(stats.mistakeCount).toBe(1)
    expect(stats.helpCount).toBe(1)
    expect(stats.lastSeenAt).toBe(100)
  })

  it('only aggregates events for the requested line id', () => {
    const stats = aggregateLineStats('l', [
      ev('mistake', 1, { lineId: 'l' }),
      ev('mistake', 2, { lineId: 'other' }),
      ev('rep_completed', 3, { lineId: 'other', durationMs: 1000 }),
    ])
    expect(stats.mistakeCount).toBe(1)
    expect(stats.repCount).toBe(0)
  })

  it('computes the mean rep duration over rep_completed events with a duration', () => {
    const stats = aggregateLineStats('l', [
      ev('rep_completed', 1, { durationMs: 2_000 }),
      ev('rep_completed', 2, { durationMs: 4_000 }),
      ev('rep_completed', 3),
    ])
    expect(stats.averageRepDurationMs).toBe(3_000)
  })

  it('computes the average mistakes per rep over rep_completed events', () => {
    const stats = aggregateLineStats('l', [
      ev('rep_completed', 1, { mistakeCount: 2 }),
      ev('rep_completed', 2, { mistakeCount: 0 }),
      ev('rep_completed', 3, { mistakeCount: 1 }),
    ])
    expect(stats.averageMistakesPerRep).toBe(1)
  })
})
