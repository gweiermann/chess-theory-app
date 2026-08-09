import { describe, expect, it } from 'vitest'
import {
  buildLearnedTree,
  isTerminal,
  sideToMove,
  validContinuations,
} from '~/domain/random-trainer/learned-tree'
import type { Line } from '~/domain/types'

const line = (
  id: string,
  sanMoves: string[],
  userSide: 'white' | 'black' = 'white',
): Line => ({
  id,
  eco: 'B00',
  fullName: id,
  pgn: sanMoves.join(' '),
  sanMoves,
  userSide,
})

const rootEdges = (nodes: string[]): string[] => {
  const tree = buildLearnedTree(nodes.map((n, i) => line(`l${i}`, n.split(' '))))
  return [...tree.root.edges.keys()]
}

describe('buildLearnedTree', () => {
  it('shares the common prefix between lines', () => {
    const tree = buildLearnedTree([
      line('a', ['e4', 'e5', 'Nf3']),
      line('b', ['e4', 'e5', 'Nc3']),
    ])

    const afterE4 = tree.root.edges.get('e4')
    const afterE5 = afterE4?.edges.get('e5')
    expect(afterE5?.edges.get('Nf3')).toBeDefined()
    expect(afterE5?.edges.get('Nc3')).toBeDefined()
    // both lines pass through e4/e5
    expect(afterE5?.count).toBe(2)
  })

  it('exposes each learned SAN as a valid continuation (multi-answer)', () => {
    const tree = buildLearnedTree([
      line('a', ['e4', 'e5', 'Nf3']),
      line('b', ['e4', 'c5']),
    ])

    expect(rootEdges(['e4 e5', 'e4 c5'])).toEqual(['e4'])
    const afterE4 = tree.root.edges.get('e4')!
    expect(validContinuations(afterE4)).toEqual(['e5', 'c5'])
  })

  it('is terminal at a leaf with no learned continuation', () => {
    const tree = buildLearnedTree([line('a', ['e4', 'e5'])])

    expect(isTerminal(tree.root)).toBe(false)
    const afterE5 = tree.root.edges.get('e4')!.edges.get('e5')!
    expect(isTerminal(afterE5)).toBe(true)
  })

  it('derives the side to move from the node FEN', () => {
    const tree = buildLearnedTree([line('a', ['e4'])])

    expect(sideToMove(tree.root)).toBe('white')
    expect(sideToMove(tree.root.edges.get('e4')!)).toBe('black')
  })

  it('skips lines whose SANs are not legal (corrupt data)', () => {
    const tree = buildLearnedTree([line('a', ['e4', 'Qh5', 'e5'])])

    // Qh5 is illegal after 1.e4; the line must not become a child.
    expect(tree.root.edges.get('e4')?.edges.has('Qh5')).toBe(false)
    expect(tree.root.edges.has('Qh5')).toBe(false)
  })

  it('handles the empty pool (no mastered lines)', () => {
    const tree = buildLearnedTree([])

    expect(isTerminal(tree.root)).toBe(true)
  })
})
