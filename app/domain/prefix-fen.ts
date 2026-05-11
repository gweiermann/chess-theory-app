import { Chess } from 'chess.js'

/** Standard chess start; matches chess.js initial FEN when no moves applied. */
export const standardStartFen = (): string => new Chess().fen()

/**
 * FEN after playing the first `plyCount` SANs of `sanMoves` from
 * the standard starting position. Used to align the board with the parent
 * prefix without first resetting to the global start.
 */
export const fenAfterFirstNSans = (
  sanMoves: readonly string[],
  plyCount: number,
): string | null => {
  if (!Number.isFinite(plyCount) || plyCount < 0) return null
  if (plyCount === 0) return standardStartFen()
  const chess = new Chess()
  for (let i = 0; i < plyCount; i += 1) {
    const san = sanMoves[i]
    if (!san) return null
    try {
      const mv = chess.move(san)
      if (!mv) return null
    } catch {
      return null
    }
  }
  return chess.fen()
}
