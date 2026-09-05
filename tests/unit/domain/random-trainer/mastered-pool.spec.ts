import { describe, expect, it } from 'vitest'
import { collectMasteredLines } from '~/domain/random-trainer/mastered-pool'
import type { Line, LineProgress, Topic } from '~/domain/types'

const line = (id: string, userSide: 'white' | 'black' = 'white'): Line => ({
  id,
  eco: 'B00',
  fullName: id,
  pgn: 'e4',
  sanMoves: ['e4'],
  userSide,
})

const topic = (id: string, lines: Line[]): Topic => ({
  id,
  firstMove: 'e4',
  label: id,
  families: [{ id: `${id}-f`, name: id, category: 'opening', lines, tree: { label: 'r', children: [] } }],
})

describe('collectMasteredLines', () => {
  it('returns mastered lines across topics, preserving their moves', () => {
    const topics = [
      topic('t1', [line('a'), line('b')]),
      topic('t2', [line('c', 'black')]),
    ]
    const progress: Record<string, LineProgress[]> = {
      t1: [
        { lineId: 'a', status: 'mastered', reps: 10 },
        { lineId: 'b', status: 'in-progress', reps: 2 },
      ],
      t2: [{ lineId: 'c', status: 'mastered', reps: 12 }],
    }

    const result = collectMasteredLines(topics, progress)

    expect(result.map((l) => l.id)).toEqual(['a', 'c'])
    expect(result.find((l) => l.id === 'c')?.userSide).toBe('black')
  })

  it('ignores topics absent from progress and unknown lines', () => {
    const topics = [topic('t1', [line('a')])]
    const progress: Record<string, LineProgress[]> = {
      t1: [{ lineId: 'ghost', status: 'mastered', reps: 1 }],
    }
    const result = collectMasteredLines(topics, progress)
    expect(result).toEqual([])
  })

  it('returns an empty pool when nothing is mastered', () => {
    const topics = [topic('t1', [line('a')])]
    expect(
      collectMasteredLines(topics, { t1: [{ lineId: 'a', status: 'new', reps: 0 }] }),
    ).toEqual([])
  })

  it('carries the family and topic context of each mastered line', () => {
    const topics = [topic('t1', [line('a')])]
    const result = collectMasteredLines(topics, {
      t1: [{ lineId: 'a', status: 'mastered', reps: 3 }],
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'a',
      topicId: 't1',
      familyId: 't1-f',
      familyName: 't1',
    })
  })
})
