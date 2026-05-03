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
