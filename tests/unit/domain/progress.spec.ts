import { describe, expect, it } from 'vitest'
import {
  initialProgress,
  markInProgress,
  markMastered,
  isMastered,
  topicMasteryRatio,
  countMasteredFamilies,
  topicFamilyMasteryRatio,
} from '~/domain/progress'
import type { Family, LineProgress } from '~/domain/types'

const line = (id: string) => ({
  id,
  eco: '',
  fullName: id,
  pgn: '',
  sanMoves: [],
  variationPath: [],
  userSide: 'white' as const,
})

const family = (id: string, lineIds: string[]): Family => ({
  id,
  name: id,
  topicId: 't',
  tree: { name: id, lineId: null, children: {} },
  lines: lineIds.map(line),
})

const masteredFor = (lineId: string): LineProgress => ({
  lineId,
  status: 'mastered',
  reps: 10,
  lastPracticedAt: 1,
})

const inProgressFor = (lineId: string): LineProgress => ({
  lineId,
  status: 'in-progress',
  reps: 1,
})

describe('LineProgress transitions', () => {
  it('starts as new with zero reps and no last-practiced timestamp', () => {
    const p = initialProgress('line-1')
    expect(p.lineId).toBe('line-1')
    expect(p.status).toBe('new')
    expect(p.reps).toBe(0)
    expect(p.lastPracticedAt).toBeUndefined()
  })

  it('markInProgress sets status and increments reps and stamps the time', () => {
    const p = initialProgress('line-1')
    const next = markInProgress(p, 5, 1_700_000_000_000)

    expect(next.status).toBe('in-progress')
    expect(next.reps).toBe(5)
    expect(next.lastPracticedAt).toBe(1_700_000_000_000)
  })

  it('markMastered transitions a fresh line all the way to mastered', () => {
    const p = initialProgress('line-1')
    const mastered = markMastered(p, 1_700_000_000_000)
    expect(mastered.status).toBe('mastered')
    expect(mastered.lastPracticedAt).toBe(1_700_000_000_000)
    expect(isMastered(mastered)).toBe(true)
  })

  it('topicMasteryRatio returns 0 when no progress is recorded', () => {
    expect(topicMasteryRatio({ totalLines: 10, mastered: 0 })).toBe(0)
  })

  it('topicMasteryRatio returns the share of mastered lines', () => {
    expect(topicMasteryRatio({ totalLines: 4, mastered: 1 })).toBe(0.25)
  })

  it('topicMasteryRatio returns 0 when no lines exist', () => {
    expect(topicMasteryRatio({ totalLines: 0, mastered: 0 })).toBe(0)
  })

  it('countMasteredFamilies counts families where every line is mastered', () => {
    const families = [
      family('f1', ['a', 'b']),
      family('f2', ['c']),
      family('f3', ['d', 'e']),
    ]
    const progress = [
      masteredFor('a'),
      masteredFor('b'),
      masteredFor('c'),
      masteredFor('d'),
      inProgressFor('e'),
    ]
    expect(countMasteredFamilies(families, progress)).toBe(2)
  })

  it('countMasteredFamilies treats families without any lines as not mastered', () => {
    const families = [{ ...family('empty', []), lines: [] }]
    expect(countMasteredFamilies(families, [])).toBe(0)
  })

  it('topicFamilyMasteryRatio reports the share of fully mastered families', () => {
    const families = [family('f1', ['a']), family('f2', ['b']), family('f3', ['c'])]
    const progress = [masteredFor('a'), masteredFor('b')]
    expect(topicFamilyMasteryRatio(families, progress)).toBeCloseTo(2 / 3)
  })

  it('topicFamilyMasteryRatio returns 0 when there are no families', () => {
    expect(topicFamilyMasteryRatio([], [])).toBe(0)
  })
})
