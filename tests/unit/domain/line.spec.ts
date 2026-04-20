import { describe, expect, it } from 'vitest'
import {
  parsePgnToSan,
  splitFamilyAndPath,
  firstMoveTopicId,
  buildLineId,
  userSideForPgn,
} from '~/domain/line'

describe('splitFamilyAndPath', () => {
  it('returns family only when name has no colon', () => {
    expect(splitFamilyAndPath('Sicilian Defense')).toEqual({
      family: 'Sicilian Defense',
      path: [],
    })
  })

  it('splits family and a single variation', () => {
    expect(splitFamilyAndPath('Sicilian Defense: Najdorf Variation')).toEqual({
      family: 'Sicilian Defense',
      path: ['Najdorf Variation'],
    })
  })

  it('splits sub-variations on commas', () => {
    expect(
      splitFamilyAndPath('Sicilian Defense: Najdorf Variation, English Attack'),
    ).toEqual({
      family: 'Sicilian Defense',
      path: ['Najdorf Variation', 'English Attack'],
    })
  })

  it('trims whitespace in path segments', () => {
    expect(
      splitFamilyAndPath("King's Gambit Accepted:  Schurig Gambit ,  with Bb5"),
    ).toEqual({
      family: "King's Gambit Accepted",
      path: ['Schurig Gambit', 'with Bb5'],
    })
  })

  it('keeps later colons inside the variation path', () => {
    expect(
      splitFamilyAndPath('Indian Game: Some Sub: Deep, Deeper'),
    ).toEqual({
      family: 'Indian Game',
      path: ['Some Sub: Deep', 'Deeper'],
    })
  })
})

describe('parsePgnToSan', () => {
  it('strips move numbers and dots', () => {
    expect(parsePgnToSan('1. e4 e5 2. Nf3 Nc6')).toEqual([
      'e4',
      'e5',
      'Nf3',
      'Nc6',
    ])
  })

  it('handles multi-digit move numbers and double dots', () => {
    expect(parsePgnToSan('1. e4 e5 2. Nf3 Nc6 3... d6')).toEqual([
      'e4',
      'e5',
      'Nf3',
      'Nc6',
      'd6',
    ])
  })

  it('returns an empty array for an empty string', () => {
    expect(parsePgnToSan('')).toEqual([])
    expect(parsePgnToSan('   ')).toEqual([])
  })
})

describe('firstMoveTopicId', () => {
  it('returns the first san move as id', () => {
    expect(firstMoveTopicId(['e4', 'e5'])).toBe('e4')
    expect(firstMoveTopicId(['d4'])).toBe('d4')
    expect(firstMoveTopicId(['Nf3'])).toBe('Nf3')
  })

  it('returns null for an empty list', () => {
    expect(firstMoveTopicId([])).toBeNull()
  })
})

describe('buildLineId', () => {
  it('combines eco and slugified name', () => {
    expect(buildLineId('B90', 'Sicilian Defense: Najdorf Variation')).toBe(
      'B90-sicilian-defense-najdorf-variation',
    )
  })

  it('removes punctuation and collapses whitespace', () => {
    expect(buildLineId('C30', "King's Gambit, Bishop's Variation")).toBe(
      'C30-kings-gambit-bishops-variation',
    )
  })
})

describe('userSideForPgn', () => {
  it('returns white when the first san is a white move', () => {
    expect(userSideForPgn(['e4'])).toBe('white')
    expect(userSideForPgn(['Nf3', 'Nf6'])).toBe('white')
  })
})
