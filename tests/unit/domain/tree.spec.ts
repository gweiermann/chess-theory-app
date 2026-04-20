import { describe, expect, it } from 'vitest'
import { buildFamilyTree } from '~/domain/tree'
import type { Line } from '~/domain/types'

const line = (id: string, fullName: string, sanMoves: string[]): Line => ({
  id,
  eco: 'B00',
  fullName,
  pgn: sanMoves.join(' '),
  sanMoves,
  userSide: 'white',
})

describe('buildFamilyTree', () => {
  it('puts a family-only line at the root with a lineId', () => {
    const tree = buildFamilyTree([line('1', 'Sicilian Defense', ['e4', 'c5'])])

    expect(tree).toEqual({
      label: 'Sicilian Defense',
      lineId: '1',
      children: [],
    })
  })

  it('nests variations under the family', () => {
    const tree = buildFamilyTree([
      line('1', 'Sicilian Defense', ['e4', 'c5']),
      line('2', 'Sicilian Defense: Najdorf Variation', [
        'e4',
        'c5',
        'Nf3',
        'd6',
        'd4',
        'cxd4',
        'Nxd4',
        'Nf6',
        'Nc3',
        'a6',
      ]),
    ])

    expect(tree.label).toBe('Sicilian Defense')
    expect(tree.lineId).toBe('1')
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toMatchObject({
      label: 'Najdorf Variation',
      lineId: '2',
      children: [],
    })
  })

  it('creates intermediate nodes for deep paths even without their own line', () => {
    const tree = buildFamilyTree([
      line('1', 'Sicilian Defense: Najdorf Variation, English Attack', [
        'e4',
        'c5',
      ]),
    ])

    expect(tree.label).toBe('Sicilian Defense')
    expect(tree.lineId).toBeUndefined()
    expect(tree.children).toHaveLength(1)
    const najdorf = tree.children[0]!
    expect(najdorf.label).toBe('Najdorf Variation')
    expect(najdorf.lineId).toBeUndefined()
    expect(najdorf.children[0]).toMatchObject({
      label: 'English Attack',
      lineId: '1',
      children: [],
    })
  })

  it('groups multiple variations under one family', () => {
    const tree = buildFamilyTree([
      line('a', 'Italian Game', ['e4', 'e5']),
      line('b', 'Italian Game: Classical Variation', ['e4', 'e5']),
      line('c', 'Italian Game: Two Knights Defense', ['e4', 'e5']),
    ])

    expect(tree.children.map((c) => c.label)).toEqual([
      'Classical Variation',
      'Two Knights Defense',
    ])
  })

  it('throws when given lines from different families', () => {
    expect(() =>
      buildFamilyTree([
        line('1', 'Sicilian Defense', ['e4', 'c5']),
        line('2', 'French Defense', ['e4', 'e6']),
      ]),
    ).toThrow(/single family/i)
  })

  it('throws on empty input', () => {
    expect(() => buildFamilyTree([])).toThrow()
  })

  it('folds "Accepted"/"Declined" siblings into the canonical family', () => {
    const tree = buildFamilyTree([
      line('base', "King's Gambit", ['e4', 'e5', 'f4']),
      line('acc', "King's Gambit Accepted", ['e4', 'e5', 'f4', 'exf4']),
      line('dec', "King's Gambit Declined", ['e4', 'e5', 'f4', 'Bc5']),
      line('accVar', "King's Gambit Accepted: Schurig Gambit", [
        'e4', 'e5', 'f4',
      ]),
    ])

    expect(tree.label).toBe("King's Gambit")
    expect(tree.lineId).toBe('base')
    const childLabels = tree.children.map((c) => c.label).sort()
    expect(childLabels).toEqual(['Accepted', 'Declined'])
    const accepted = tree.children.find((c) => c.label === 'Accepted')!
    expect(accepted.lineId).toBe('acc')
    expect(accepted.children.map((c) => c.label)).toEqual(['Schurig Gambit'])
  })
})
