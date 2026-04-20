import { describe, expect, it } from 'vitest'
import {
  buildLineId,
  classifyFamily,
  firstMoveTopicId,
  isDefenseFamily,
  normalizeFamilyName,
  parsePgnToSan,
  splitFamilyAndPath,
  userSideForLine,
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

describe('normalizeFamilyName', () => {
  it('strips a trailing " Accepted" suffix', () => {
    expect(normalizeFamilyName('Center Game Accepted')).toBe('Center Game')
    expect(normalizeFamilyName("King's Gambit Accepted")).toBe("King's Gambit")
  })

  it('strips a trailing " Declined" suffix', () => {
    expect(normalizeFamilyName('Danish Gambit Declined')).toBe('Danish Gambit')
  })

  it('leaves unrelated names unchanged', () => {
    expect(normalizeFamilyName('Italian Game')).toBe('Italian Game')
    expect(normalizeFamilyName('Alekhine Defense')).toBe('Alekhine Defense')
  })

  it('only strips the suffix as a full trailing word (not substring hits)', () => {
    expect(normalizeFamilyName('Acceptedly Named Opening')).toBe(
      'Acceptedly Named Opening',
    )
  })
})

describe('isDefenseFamily', () => {
  it('is true for families that end in "Defense"', () => {
    expect(isDefenseFamily('Alekhine Defense')).toBe(true)
    expect(isDefenseFamily('Sicilian Defense')).toBe(true)
    expect(isDefenseFamily('French Defense')).toBe(true)
  })

  it('is false for openings, attacks and gambits', () => {
    expect(isDefenseFamily('Italian Game')).toBe(false)
    expect(isDefenseFamily("King's Gambit")).toBe(false)
    expect(isDefenseFamily('Bongcloud Attack')).toBe(false)
    expect(isDefenseFamily('Ruy Lopez')).toBe(false)
  })
})

describe('userSideForLine', () => {
  it('returns black for defenses (so white moves first visually)', () => {
    expect(userSideForLine('Alekhine Defense', ['e4', 'Nf6'])).toBe('black')
    expect(userSideForLine('Sicilian Defense', ['e4', 'c5'])).toBe('black')
  })

  it('returns white for openings, attacks and gambits', () => {
    expect(userSideForLine('Italian Game', ['e4', 'e5'])).toBe('white')
    expect(userSideForLine("King's Gambit", ['e4', 'e5', 'f4'])).toBe('white')
    expect(userSideForLine('Bongcloud Attack', ['e4'])).toBe('white')
  })
})

describe('classifyFamily', () => {
  it('classifies defenses first, even if the name also contains "gambit"', () => {
    expect(classifyFamily('Sicilian Defense')).toBe('defense')
    expect(classifyFamily('Alekhine Defense')).toBe('defense')
  })

  it('classifies gambits by the "gambit"/"countergambit" keyword', () => {
    expect(classifyFamily("King's Gambit")).toBe('gambit')
    expect(classifyFamily('Danish Gambit')).toBe('gambit')
    expect(classifyFamily('Blumenfeld Countergambit')).toBe('gambit')
  })

  it('classifies everything else as opening', () => {
    expect(classifyFamily('Italian Game')).toBe('opening')
    expect(classifyFamily('Ruy Lopez')).toBe('opening')
    expect(classifyFamily('Bongcloud Attack')).toBe('opening')
    expect(classifyFamily('English Opening')).toBe('opening')
  })
})
