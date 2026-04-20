import { describe, expect, it } from 'vitest'
import {
  selectNextLine,
  selectNextLineInFamily,
  selectLineForFocus,
} from '~/domain/select-next-line'
import type { Family, Line, LineProgress, Topic } from '~/domain/types'

const line = (id: string): Line => ({
  id,
  eco: '',
  fullName: id,
  pgn: '',
  sanMoves: [],
  userSide: 'white',
})

const family = (id: string, lineIds: string[]): Family => ({
  id,
  name: id,
  tree: { label: id, children: [] },
  lines: lineIds.map(line),
})

const topic = (families: Family[]): Topic => ({
  id: 't',
  firstMove: 'e4',
  label: '1.e4',
  families,
})

const mastered = (lineId: string): LineProgress => ({
  lineId,
  status: 'mastered',
  reps: 10,
  lastPracticedAt: 1,
})

describe('selectNextLine', () => {
  it('returns the first unmastered line across all families in order', () => {
    const t = topic([family('f1', ['a', 'b']), family('f2', ['c', 'd'])])
    expect(selectNextLine(t, [mastered('a')])?.id).toBe('b')
  })

  it('returns null when all lines are mastered', () => {
    const t = topic([family('f1', ['a'])])
    expect(selectNextLine(t, [mastered('a')])).toBeNull()
  })
})

describe('selectNextLineInFamily', () => {
  it('returns the first unmastered line within a single family', () => {
    const f = family('f', ['a', 'b', 'c'])
    expect(selectNextLineInFamily(f, [mastered('a')])?.id).toBe('b')
  })

  it('returns null when every line in the family is mastered', () => {
    const f = family('f', ['a', 'b'])
    expect(
      selectNextLineInFamily(f, [mastered('a'), mastered('b')]),
    ).toBeNull()
  })
})

describe('selectLineForFocus', () => {
  const t = topic([
    family('f1', ['a', 'b']),
    family('f2', ['c', 'd']),
  ])

  it('returns the focused line itself when it is not yet mastered', () => {
    const result = selectLineForFocus(t, { kind: 'line', lineId: 'b' }, [])
    expect(result?.id).toBe('b')
  })

  it('falls back to next line in the same family when the focused line is mastered', () => {
    const result = selectLineForFocus(
      t,
      { kind: 'line', lineId: 'a' },
      [mastered('a')],
    )
    expect(result?.id).toBe('b')
  })

  it('falls back to the next family when the focused family is fully mastered', () => {
    const result = selectLineForFocus(
      t,
      { kind: 'line', lineId: 'a' },
      [mastered('a'), mastered('b')],
    )
    expect(result?.id).toBe('c')
  })

  it('returns the next unmastered line in a focused family', () => {
    const result = selectLineForFocus(
      t,
      { kind: 'family', familyId: 'f2' },
      [mastered('c')],
    )
    expect(result?.id).toBe('d')
  })

  it('moves on to the next family once the focused family is done', () => {
    const result = selectLineForFocus(
      t,
      { kind: 'family', familyId: 'f1' },
      [mastered('a'), mastered('b')],
    )
    expect(result?.id).toBe('c')
  })

  it('returns the topic-wide next line when focus is the whole topic', () => {
    expect(
      selectLineForFocus(t, { kind: 'topic' }, [mastered('a')])?.id,
    ).toBe('b')
  })

  it('returns null if the focus references an unknown line/family', () => {
    expect(
      selectLineForFocus(t, { kind: 'line', lineId: 'zzz' }, []),
    ).toBeNull()
    expect(
      selectLineForFocus(t, { kind: 'family', familyId: 'zzz' }, []),
    ).toBeNull()
  })
})
