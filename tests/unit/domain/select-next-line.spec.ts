import { describe, expect, it } from 'vitest'
import {
  findParentLine,
  selectNextLine,
  selectNextLineInFamily,
  selectLineForFocus,
} from '~/domain/select-next-line'
import type { Family, Line, LineProgress, Side, Topic } from '~/domain/types'

const line = (id: string, sanMoves: string[] = [], userSide: Side = 'white'): Line => ({
  id,
  eco: '',
  fullName: id,
  pgn: '',
  sanMoves,
  userSide,
})

const family = (id: string, lines: Line[] | string[]): Family => ({
  id,
  name: id,
  category: 'opening',
  tree: { label: id, children: [] },
  lines: (lines as Array<Line | string>).map((l) =>
    typeof l === 'string' ? line(l) : l,
  ),
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

  it('honors an exclusive line focus even when the line is already mastered', () => {
    const result = selectLineForFocus(
      t,
      { kind: 'line', lineId: 'a', exclusive: true },
      [mastered('a')],
    )
    expect(result?.id).toBe('a')
  })
})

describe('findParentLine', () => {
  const parent = line('italian-game', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])
  const classical = line(
    'italian-classical',
    ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
  )
  const unrelated = line('ruy-lopez', ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])
  const shortChild = line('short', ['e4', 'e5', 'Nf3'])
  const italianFamily = family('italian', [parent, classical, unrelated, shortChild])
  const italianTopic = topic([italianFamily])

  it('returns the mastered line whose moves are a strict prefix of the child', () => {
    const result = findParentLine(italianTopic, classical, [
      { lineId: parent.id, status: 'mastered', reps: 5 },
    ])
    expect(result?.id).toBe(parent.id)
  })

  it('ignores candidates that are not a prefix', () => {
    const result = findParentLine(italianTopic, classical, [
      { lineId: unrelated.id, status: 'mastered', reps: 5 },
    ])
    expect(result).toBeNull()
  })

  it('ignores candidates that are not mastered yet', () => {
    const result = findParentLine(italianTopic, classical, [
      { lineId: parent.id, status: 'in-progress', reps: 1 },
    ])
    expect(result).toBeNull()
  })

  it('prefers the longest mastered prefix when several ancestors qualify', () => {
    const result = findParentLine(italianTopic, classical, [
      { lineId: parent.id, status: 'mastered', reps: 5 },
      { lineId: shortChild.id, status: 'mastered', reps: 5 },
    ])
    expect(result?.id).toBe(parent.id)
  })

  it('does not treat the line itself as its own parent even if mastered', () => {
    const result = findParentLine(italianTopic, classical, [
      { lineId: classical.id, status: 'mastered', reps: 5 },
    ])
    expect(result).toBeNull()
  })

  it('requires the same user side so the board orientation stays consistent', () => {
    const whiteParent = line('w', ['e4', 'e5'], 'white')
    const blackChild = line('b', ['e4', 'e5', 'Nf3'], 'black')
    const t = topic([family('f', [whiteParent, blackChild])])
    const result = findParentLine(t, blackChild, [
      { lineId: whiteParent.id, status: 'mastered', reps: 5 },
    ])
    expect(result).toBeNull()
  })

  it('finds mastered parents across family boundaries', () => {
    const kingsPawn = line('kings-pawn', ['e4', 'e5'])
    const italianDeep = line('italian-deep', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])
    const t = topic([
      family('kings-pawn-game', [kingsPawn]),
      family('italian', [italianDeep]),
    ])
    const result = findParentLine(t, italianDeep, [
      { lineId: kingsPawn.id, status: 'mastered', reps: 5 },
    ])
    expect(result?.id).toBe(kingsPawn.id)
  })
})
