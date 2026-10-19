import type { Side } from '../shared'

export interface MistakeContinuation {
  moves: readonly string[]
  advantageCp: number
}
export interface MistakeBranch {
  id: string
  history: readonly string[]
  mistake: string
  lossCp: number
  advantageCp: number
  paths: readonly MistakeContinuation[]
}
export interface MistakeDataset {
  version: 1
  revision: string
  openingRevision: string
  engine: {
    name: string
    sha256: string
    source: string
    threads: 1
    hashMb: number
  }
  policy: {
    screenNodes: number
    verifyNodes: number
    minimumLossCp: number
    minimumAdvantageCp: number
    maximumPlayerMoves: number
    responseToleranceCp: number
  }
  coverage: { positions: number; analyzed: number; terminalPositions: number }
  branches: readonly MistakeBranch[]
}
/** Full SAN histories keep course move orders distinct, including transpositions. */
export interface MistakeBook {
  revision: string
  at(history: readonly string[], side: Side): readonly MistakeBranch[]
  get(id: string): MistakeBranch | undefined
}
