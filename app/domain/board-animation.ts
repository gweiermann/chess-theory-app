/**
 * Chessground animates position/moves when {@link BOARD_MOVE_ANIMATION_DURATION_MS}
 * is at least ~70ms. Used by ChessBoard config and callers that must wait one
 * full animation cycle (e.g. reset-to-start before instant prefix replay).
 */
export const BOARD_MOVE_ANIMATION_DURATION_MS = 220

/** RAF / easing tail after {@link BOARD_MOVE_ANIMATION_DURATION_MS}. */
export const BOARD_ANIMATION_TAIL_BUFFER_MS = 32

/** Wait after a Chessground fen/move animation before applying instant-follow-up updates. */
export const boardAnimationSettleMs = (): number =>
  BOARD_MOVE_ANIMATION_DURATION_MS + BOARD_ANIMATION_TAIL_BUFFER_MS
