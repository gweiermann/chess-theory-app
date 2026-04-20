import { describe, expect, it } from 'vitest'
import { recentActivity } from '~/domain/recent-activity'
import type { LineProgress } from '~/domain/types'

const lp = (
  lineId: string,
  status: LineProgress['status'],
  lastPracticedAt?: number,
): LineProgress => ({ lineId, status, reps: 0, lastPracticedAt })

describe('recentActivity', () => {
  it('returns entries sorted by lastPracticedAt descending', () => {
    const result = recentActivity({
      e4: [lp('a', 'in-progress', 100), lp('b', 'mastered', 300)],
      d4: [lp('c', 'in-progress', 200)],
    })

    expect(result.map((r) => r.lineId)).toEqual(['b', 'c', 'a'])
    expect(result.map((r) => r.topicId)).toEqual(['e4', 'd4', 'e4'])
  })

  it('skips entries that have never been practiced', () => {
    const result = recentActivity({
      e4: [lp('a', 'new'), lp('b', 'in-progress', 50)],
    })
    expect(result.map((r) => r.lineId)).toEqual(['b'])
  })

  it('limits the number of entries when a limit is given', () => {
    const result = recentActivity(
      {
        e4: [
          lp('a', 'in-progress', 1),
          lp('b', 'in-progress', 2),
          lp('c', 'in-progress', 3),
        ],
      },
      { limit: 2 },
    )
    expect(result.map((r) => r.lineId)).toEqual(['c', 'b'])
  })

  it('preserves status and timestamp on each entry', () => {
    const result = recentActivity({
      e4: [lp('a', 'mastered', 42)],
    })
    expect(result[0]).toEqual({
      topicId: 'e4',
      lineId: 'a',
      status: 'mastered',
      lastPracticedAt: 42,
    })
  })
})
