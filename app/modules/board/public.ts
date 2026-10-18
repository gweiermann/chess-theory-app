import type { GameRecord, MoveInput, Side, Unsubscribe } from '../shared'
export type { GameRecord, MoveInput, Side } from '../shared'
export interface Piece {
  square: string
  type: string
  side: Side
}
export interface BoardArrow {
  from: string
  to: string
  purpose: 'solution' | 'exploration' | 'demonstration'
}
export interface BoardSnapshot {
  /** Changes when a game is loaded or a checkpoint is restored, never on an ordinary move. */
  gameId: string
  revision: number
  fen: string
  positionKey: string
  turn: Side
  moves: readonly string[]
  pieces: readonly Piece[]
  legalMoves: readonly {
    from: string
    to: string
    san: string
    promotion?: string
  }[]
  orientation: Side
  playerSide: Side
  input: 'disabled' | 'player' | 'premove'
  viewedPly: number | null
  arrows: readonly BoardArrow[]
  premove: { from: string; to: string; promotion?: string } | null
  premoveQueue: readonly { from: string; to: string; promotion?: string }[]
  lastPremove: {
    from: string
    to: string
    promotion?: string
    revision: number
  } | null
}
export interface MoveAttempt {
  id: string
  revision: number
  san: string
  from: string
  to: string
  positionKey: string
}
export type AttemptResult =
  | { status: 'proposed'; attempt: MoveAttempt }
  | { status: 'illegal' | 'disabled' | 'queued' }
export type BoardResult = {
  status: 'accepted' | 'rejected' | 'illegal' | 'stale' | 'cancelled'
  san?: string
}
export interface BoardCheckpoint {
  readonly owner: string
  readonly game: GameRecord
}
export interface BoardSession {
  snapshot(): Readonly<BoardSnapshot>
  load(game: GameRecord): BoardResult
  proposeMove(move: MoveInput): AttemptResult
  acceptMove(
    attemptId: string,
    options?: { preservePremoves?: boolean },
  ): BoardResult
  rejectMove(attemptId: string): BoardResult
  makeMove(move: MoveInput, expectedRevision?: number): BoardResult
  saveCheckpoint(): BoardCheckpoint
  resetToCheckpoint(checkpoint: BoardCheckpoint): BoardResult
  configureInput(options: {
    orientation?: Side
    playerSide?: Side
    input?: BoardSnapshot['input']
    premoves?: boolean
  }): void
  showArrows(arrows: readonly BoardArrow[]): void
  viewHistory(ply: number | null): BoardResult
  takePremove(): MoveInput | null
  subscribe(listener: () => void): Unsubscribe
  dispose(): void
}
