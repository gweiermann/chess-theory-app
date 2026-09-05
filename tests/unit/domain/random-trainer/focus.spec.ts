import { describe, expect, it } from 'vitest'
import type { MasteredLine } from '~/domain/random-trainer/mastered-pool'
import {
  decideNextFocus,
  groupByFamily,
  keepMaximal,
  MASTERY_MAX,
  pickInitialFamily,
  pickSideFamily,
  pickTargetLine,
  switchProbability,
  updateMastery,
  type FocusFamily,
  type FocusState,
} from '~/domain/random-trainer/focus'

const mastered = (
  id: string,
  family: string,
  sanMoves: string[],
): MasteredLine => ({
  id,
  eco: 'C23',
  fullName: id,
  pgn: '',
  sanMoves,
  userSide: 'white',
  topicId: 'e4',
  familyId: family,
  familyName: family,
})

describe('keepMaximal', () => {
  it('drops a line that is a strict prefix of a longer mastered line', () => {
    const short = mastered('a', 'it', ['e4', 'e5'])
    const long = mastered('b', 'it', ['e4', 'e5', 'Bc4'])
    expect(keepMaximal([short, long]).map((l) => l.id)).toEqual(['b'])
  })

  it('keeps siblings that are not prefixes of each other', () => {
    const a = mastered('a', 'it', ['e4', 'e5', 'Bc4'])
    const b = mastered('b', 'it', ['e4', 'e5', 'Nf3'])
    expect(keepMaximal([a, b]).map((l) => l.id)).toEqual(['a', 'b'])
  })

  it('in a nested chain only the deepest line survives', () => {
    const one = mastered('1', 'it', ['e4', 'e5'])
    const two = mastered('2', 'it', ['e4', 'e5', 'Bc4'])
    const three = mastered('3', 'it', ['e4', 'e5', 'Bc4', 'Bc5'])
    expect(keepMaximal([one, two, three]).map((l) => l.id)).toEqual(['3'])
  })

  it('keeps non-comparable lines across families', () => {
    const a = mastered('a', 'it', ['e4', 'e5', 'Bc4'])
    const b = mastered('b', 'sc', ['c4', 'e6', 'Nf3'])
    expect(keepMaximal([a, b]).map((l) => l.id)).toEqual(['a', 'b'])
  })

  it('keeps two duplicate lines (neither is a strict prefix of the other)', () => {
    const a = mastered('a', 'it', ['e4', 'e5'])
    const b = mastered('b', 'it', ['e4', 'e5'])
    expect(keepMaximal([a, b]).map((l) => l.id)).toEqual(['a', 'b'])
  })

  it('is empty for an empty pool', () => {
    expect(keepMaximal([])).toEqual([])
  })
})

describe('groupByFamily', () => {
  it('groups maximal lines by family and preserves insertion order', () => {
    const a = mastered('a', 'it', ['e4', 'e5', 'Bc4'])
    const b = mastered('b', 'it', ['e4', 'e5', 'Nf3'])
    const c = mastered('c', 'sc', ['c4', 'e5', 'Nf3'])
    const groups = groupByFamily([a, b, c])
    expect(groups.map((g) => g.id)).toEqual(['it', 'sc'])
    expect(groups[0]?.name).toBe('it')
    expect(groups[0]?.lines.map((l) => l.id)).toEqual(['a', 'b'])
  })
})

describe('updateMastery', () => {
  it('a clean target round gains +1 (clamped at the max)', () => {
    expect(updateMastery(0, { targetMet: true, mistakes: 0 })).toBe(1)
    expect(updateMastery(MASTERY_MAX, { targetMet: true, mistakes: 0 })).toBe(MASTERY_MAX)
  })

  it('a round with a mistake loses 1 (clamped at 0)', () => {
    expect(updateMastery(5, { targetMet: false, mistakes: 1 })).toBe(4)
    expect(updateMastery(0, { targetMet: false, mistakes: 2 })).toBe(0)
  })

  it('a clean but divergent round gains +0.5', () => {
    expect(updateMastery(3, { targetMet: false, mistakes: 0 })).toBe(3.5)
  })
})

describe('switchProbability', () => {
  it('starts at 0.1 for a fresh family and rises to 0.7 at max mastery', () => {
    expect(switchProbability(0)).toBe(0.1)
    expect(switchProbability(MASTERY_MAX)).toBe(0.7)
    expect(switchProbability(5)).toBe(0.4)
  })

  it('clamps out-of-range mastery values', () => {
    expect(switchProbability(-3)).toBe(0.1)
    expect(switchProbability(99)).toBe(0.7)
  })
})

describe('decideNextFocus', () => {
  const itLine = mastered('it1', 'it', ['e4', 'e5', 'Bc4'])
  const scLine = mastered('sc1', 'sc', ['c4', 'e5', 'Nf3'])
  const ruLine = mastered('ru1', 'ru', ['e4', 'e5', 'Nf3'])
  const groups = groupByFamily([itLine, scLine, ruLine])

  it('draws an initial focus when none is set yet', () => {
    const state: FocusState = { currentFamilyId: null, masteryByFamily: {} }
    const { next, switched } = decideNextFocus(state, groups, { targetMet: true, mistakes: 0 }, () => 0)
    expect(switched).toBe(false)
    expect(groups.some((g) => g.id === next.currentFamilyId)).toBe(true)
  })

  it('stays in the focus family while mastery is low (rng above p_switch)', () => {
    const state: FocusState = { currentFamilyId: 'it', masteryByFamily: { it: 0 } }
    // p_switch = 0.1; rng 0.5 is above it → stay.
    const { next, switched } = decideNextFocus(state, groups, { targetMet: true, mistakes: 0 }, () => 0.5)
    expect(switched).toBe(false)
    expect(next.currentFamilyId).toBe('it')
    expect(next.masteryByFamily.it).toBe(1)
  })

  it('switches to a different family once mastery is high enough (rng below p_switch)', () => {
    const state: FocusState = { currentFamilyId: 'it', masteryByFamily: { it: 10 } }
    // p_switch = 0.7; rng 0.5 is below it → switch to a different family.
    const { next, switched } = decideNextFocus(state, groups, { targetMet: true, mistakes: 0 }, () => 0.5)
    expect(switched).toBe(true)
    expect(next.currentFamilyId).not.toBe('it')
    expect(groups.some((g) => g.id === next.currentFamilyId)).toBe(true)
  })

  it('never reports a switch when there is only one family', () => {
    const family = mastered('a', 'only', ['e4', 'e5', 'Bc4'])
    const single = groupByFamily([family])
    const state: FocusState = { currentFamilyId: 'only', masteryByFamily: { only: 10 } }
    const { next, switched } = decideNextFocus(state, single, { targetMet: false, mistakes: 1 }, () => 0)
    expect(switched).toBe(false)
    expect(next.currentFamilyId).toBe('only')
  })
})

describe('pickInitialFamily', () => {
  it('weights by maximal line count and does not unconditionally return the first family', () => {
    const groups = groupByFamily([
      mastered('it1', 'it', ['e4', 'e5', 'Bc4']),
      mastered('sc1', 'sc', ['c4', 'e5']),
      mastered('ru1', 'ru', ['e4', 'e5', 'Nf3']),
    ])
    // With three single-line families (total weight 3), a high rng lands on the
    // last family — proving the weighted draw runs instead of always taking
    // families[0] ('it').
    expect(pickInitialFamily(groups, () => 0.99).id).toBe('ru')
  })

  it('biases toward a family that holds most of the maximal lines', () => {
    const groups = groupByFamily([
      mastered('bulk1', 'bulk', ['e4', 'e5', 'Bc4']),
      mastered('bulk2', 'bulk', ['e4', 'e5', 'Nf3']),
      mastered('bulk3', 'bulk', ['e4', 'e5', 'c5']),
      mastered('bulk4', 'bulk', ['e4', 'e5', 'g6']),
      mastered('other1', 'other', ['c4', 'e5']),
    ])
    // total weight 5; rng 0.35 -> r=1.75 -> falls inside the 4-line 'bulk'
    // family, even though it is listed first.
    expect(pickInitialFamily(groups, () => 0.35).id).toBe('bulk')
  })
})

describe('pickTargetLine', () => {
  it('avoids a given line when the family has alternatives', () => {
    const fam: FocusFamily = {
      id: 'it',
      name: 'it',
      lines: [
        mastered('a', 'it', ['e4', 'e5', 'Bc4']),
        mastered('b', 'it', ['e4', 'e5', 'Nf3']),
      ],
    }
    // rng 0 still maps to an index over candidates (2), not the original 2-line array,
    // and the avoided id 'a' is never returned.
    expect(pickTargetLine(fam, () => 0, 'a')?.id).not.toBe('a')
  })

  it('repeats the only line when no alternative exists', () => {
    const fam: FocusFamily = {
      id: 'it',
      name: 'it',
      lines: [mastered('a', 'it', ['e4', 'e5', 'Bc4'])],
    }
    expect(pickTargetLine(fam, () => 0, 'a')?.id).toBe('a')
  })

  it('returns null for an empty family', () => {
    const fam: FocusFamily = { id: 'it', name: 'it', lines: [] }
    expect(pickTargetLine(fam, () => 0)).toBeNull()
  })
})

describe('pickSideFamily', () => {  const groups = groupByFamily([
    mastered('a', 'it', ['e4', 'e5', 'Bc4']),
    mastered('b', 'sc', ['c4', 'e5']),
    mastered('c', 'ru', ['e4', 'e5', 'Nf3']),
  ])

  it('never returns the current family', () => {
    for (let i = 0; i < 50; i++) {
      const picked = pickSideFamily(groups, 'it', () => i / 50)
      expect(picked?.id).not.toBe('it')
    }
  })

  it('returns null when the current family is the only one', () => {
    const single = groupByFamily([mastered('a', 'only', ['e4', 'e5'])])
    expect(pickSideFamily(single, 'only', () => 0)).toBeNull()
  })
})
