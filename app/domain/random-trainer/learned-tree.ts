import { Chess } from 'chess.js'
import { standardStartFen } from '~/domain/prefix-fen'
import type { Line, Side } from '~/domain/types'

/**
 * A node in the merged position tree of all mastered ("learned") variations.
 * The tree is a trie keyed by SAN from the standard start position. Because a
 * SAN is canonical for a given board position, sharing a prefix and branching
 * are captured naturally: every `edges` key is a *valid learned continuation*
 * from this position, and the user may pick any of them (multiple correct
 * answers). Building edges by SAN (not FEN) keeps the traversal inside the
 * exact move sequences the learner actually trained on.
 */
export interface LearnedNode {
  /** FEN of the position reached by the SAN path from the root. */
  fen: string
  /** SAN → child. Keys are the valid learned continuations from this node. */
  edges: Map<string, LearnedNode>
  /** Number of mastered lines that pass through this node. */
  count: number
}

export interface LearnedTree {
  root: LearnedNode
  nodeCount: number
}

/**
 * Merge mastered lines into a single position tree. Lines whose SANs are not
 * legal from the standard start (or become illegal partway) are skipped rather
 * than aborting the whole build — corrupt data must not crash the mode.
 */
export const buildLearnedTree = (lines: readonly Line[]): LearnedTree => {
  const root: LearnedNode = {
    fen: standardStartFen(),
    edges: new Map(),
    count: 0,
  }
  let nodeCount = 1

  for (const line of lines) {
    let node = root
    node.count += 1
    const chess = new Chess()
    for (const san of line.sanMoves) {
      let moved: boolean
      try {
        moved = chess.move(san) !== null
      } catch {
        moved = false
      }
      if (!moved) break
      let child = node.edges.get(san)
      if (!child) {
        child = { fen: chess.fen(), edges: new Map(), count: 0 }
        node.edges.set(san, child)
        nodeCount += 1
      }
      node = child
      node.count += 1
    }
  }

  return { root, nodeCount }
}

/** All legal learned continuations (SAN) from a node — the multi-answer set. */
export const validContinuations = (node: LearnedNode): string[] =>
  [...node.edges.keys()]

/** A node with no learned continuation is the end of a variation (leaf). */
export const isTerminal = (node: LearnedNode): boolean =>
  node.edges.size === 0

/** Which side is to move at a node's position, derived from its FEN. */
export const sideToMove = (node: LearnedNode): Side => {
  const turn = node.fen.split(' ')[1]
  return turn === 'b' ? 'black' : 'white'
}
