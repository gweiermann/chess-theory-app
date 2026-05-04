import { describe, expect, it } from 'vitest'
import { computeLineSetup } from '~/domain/line-setup'
import type { Family, Line, LineProgress, Topic } from '~/domain/types'

const buildLine = (id: string, sanMoves: string[], userSide: 'white' | 'black' = 'white'): Line => ({
  id,
  eco: 'C00',
  fullName: id,
  pgn: '',
  sanMoves,
  userSide,
})

const buildFamily = (id: string, lines: Line[]): Family => ({
  id,
  name: id,
  category: 'opening',
  lines,
  tree: { label: id, children: [] },
})

const buildTopic = (families: Family[]): Topic => ({
  id: 'e4',
  firstMove: 'e4',
  label: 'e4',
  families,
})

describe('computeLineSetup', () => {
  it('returns no prefix when the line has no parent', () => {
    const line = buildLine('a', ['e4', 'e5', 'Nf3'])
    const topic = buildTopic([buildFamily('f', [line])])
    const setup = computeLineSetup({
      topic,
      line,
      progress: [],
      focus: { kind: 'line', lineId: 'a' },
      autoPlayParentPrefix: false,
    })
    expect(setup.prefixPlies).toBe(0)
    expect(setup.skipIntro).toBe(true)
  })

  it('runs intro when a real parent exists, autoPlay is off, and selection is not exclusive', () => {
    const parent = buildLine('parent', ['e4', 'e5', 'Nf3'])
    const child = buildLine('child', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'])
    const topic = buildTopic([buildFamily('f', [parent, child])])
    const progress: LineProgress[] = [
      { lineId: 'parent', status: 'mastered', reps: 5, lastPracticedAt: 1 },
    ]
    const setup = computeLineSetup({
      topic,
      line: child,
      progress,
      focus: { kind: 'family', familyId: 'f' },
      autoPlayParentPrefix: false,
    })
    expect(setup.prefixPlies).toBe(3)
    expect(setup.skipIntro).toBe(false)
  })

  it('skips intro when autoPlayParentPrefix is on', () => {
    const parent = buildLine('parent', ['e4', 'e5', 'Nf3'])
    const child = buildLine('child', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'])
    const topic = buildTopic([buildFamily('f', [parent, child])])
    const progress: LineProgress[] = [
      { lineId: 'parent', status: 'mastered', reps: 5, lastPracticedAt: 1 },
    ]
    const setup = computeLineSetup({
      topic,
      line: child,
      progress,
      focus: { kind: 'family', familyId: 'f' },
      autoPlayParentPrefix: true,
    })
    expect(setup.prefixPlies).toBe(3)
    expect(setup.skipIntro).toBe(true)
  })

  it('skips intro when the user picked the line exclusively', () => {
    const parent = buildLine('parent', ['e4', 'e5', 'Nf3'])
    const child = buildLine('child', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'])
    const topic = buildTopic([buildFamily('f', [parent, child])])
    const progress: LineProgress[] = [
      { lineId: 'parent', status: 'mastered', reps: 5, lastPracticedAt: 1 },
    ]
    const setup = computeLineSetup({
      topic,
      line: child,
      progress,
      focus: { kind: 'line', lineId: 'child', exclusive: true },
      autoPlayParentPrefix: false,
    })
    expect(setup.prefixPlies).toBe(3)
    expect(setup.skipIntro).toBe(true)
  })

  it('honours a node-focus prefixLineId when the candidate is mastered and a valid prefix', () => {
    const candidate = buildLine('cand', ['e4', 'e5', 'Nf3'])
    const child = buildLine('child', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'])
    const topic = buildTopic([buildFamily('f', [candidate, child])])
    const progress: LineProgress[] = [
      { lineId: 'cand', status: 'mastered', reps: 5, lastPracticedAt: 1 },
    ]
    const setup = computeLineSetup({
      topic,
      line: child,
      progress,
      focus: { kind: 'node', lineIds: ['child'], prefixLineId: 'cand' },
      autoPlayParentPrefix: false,
    })
    expect(setup.prefixPlies).toBe(3)
    // node prefixLineId counts as explicit selection ⇒ skip intro
    expect(setup.skipIntro).toBe(true)
  })

  it('ignores a node-focus prefix candidate that is not yet mastered', () => {
    const candidate = buildLine('cand', ['e4', 'e5', 'Nf3'])
    const child = buildLine('child', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'])
    const topic = buildTopic([buildFamily('f', [candidate, child])])
    const setup = computeLineSetup({
      topic,
      line: child,
      progress: [],
      focus: { kind: 'node', lineIds: ['child'], prefixLineId: 'cand' },
      autoPlayParentPrefix: false,
    })
    expect(setup.prefixPlies).toBe(0)
    expect(setup.skipIntro).toBe(true)
  })

  it('drops a parent that leaves no user moves after the prefix', () => {
    // 5-move parent, 6-move child whose only extra ply is the opponent's move.
    const parent = buildLine('parent', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])
    const child = buildLine('child', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Be7'])
    const topic = buildTopic([buildFamily('f', [parent, child])])
    const progress: LineProgress[] = [
      { lineId: 'parent', status: 'mastered', reps: 5, lastPracticedAt: 1 },
    ]
    const setup = computeLineSetup({
      topic,
      line: child,
      progress,
      focus: { kind: 'family', familyId: 'f' },
      autoPlayParentPrefix: false,
    })
    expect(setup.prefixPlies).toBe(0)
    expect(setup.skipIntro).toBe(true)
  })
})
