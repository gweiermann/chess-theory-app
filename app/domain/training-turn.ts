import type { Line, Side } from '~/domain/types'

/** True when the ply at `expectedIndex` in `line.sanMoves` is played by the opponent (not the user). */
export const isOpponentPly = (
  line: Pick<Line, 'sanMoves' | 'userSide'>,
  expectedIndex: number,
): boolean => {
  if (expectedIndex >= line.sanMoves.length) return false
  const moveSide: Side = expectedIndex % 2 === 0 ? 'white' : 'black'
  return moveSide !== line.userSide
}

/**
 * Hilfe cannot be used: no line or the viewed position waits on the opponent
 * (e.g. move-history scrub), independent of whether a board hint is drawn.
 */
export const isPlayHelpStructurallyDisabled = (
  line: Pick<Line, 'sanMoves' | 'userSide'> | null,
  nextMoveIndexAtView: number,
): boolean => {
  if (!line) return true
  return isOpponentPly(line, nextMoveIndexAtView)
}

/**
 * Hilfe is unavailable for the current board view: stepping move history
 * (Vor replays the best line moves), no line, or opponent to move at this ply.
 */
export const isPlayHelpBlockedAtView = (
  line: Pick<Line, 'sanMoves' | 'userSide'> | null,
  nextMoveIndexAtView: number,
  isScrubbingMoveHistory: boolean,
): boolean => {
  if (isScrubbingMoveHistory) return true
  return isPlayHelpStructurallyDisabled(line, nextMoveIndexAtView)
}
