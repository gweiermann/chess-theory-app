import type { BoardApi } from 'vue3-chessboard'

export const ITALIAN_GAME_OPENING: ReadonlyArray<string> = [
  'e4',
  'e5',
  'Nf3',
  'Nc6',
  'Bc4',
  'Bc5',
  'c3',
  'Nf6',
]

export const playMoves = (api: BoardApi, moves: ReadonlyArray<string>): void => {
  for (const san of moves) {
    api.move(san)
  }
}
