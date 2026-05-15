/**
 * Dev bridge: apply SAN on Chessground before session `submit` so the visible
 * position matches training state (pointer moves already update Chessground via
 * vue3-chessboard before submit). If the SAN is chess-illegal from the current
 * position, `playOpponentSan` fails — skip `submit` so behavior matches the
 * board (no move, no wrong-move / hint side effects).
 */
export type PrepareDevPlayBoardResult =
  | { ok: true }
  | { ok: false; reason: 'no-board' | 'illegal-move' }

export interface DevPlayBoardHandle {
  playOpponentSan: (san: string) => boolean
}

export const prepareDevPlayBoardForUserSubmit = (
  board: DevPlayBoardHandle | null | undefined,
  san: string,
): PrepareDevPlayBoardResult => {
  if (!board) return { ok: false, reason: 'no-board' }
  if (!board.playOpponentSan(san)) return { ok: false, reason: 'illegal-move' }
  return { ok: true }
}
