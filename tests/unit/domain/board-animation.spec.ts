import { describe, expect, it } from 'vitest'
import {
  BOARD_ANIMATION_TAIL_BUFFER_MS,
  BOARD_MOVE_ANIMATION_DURATION_MS,
  boardAnimationSettleMs,
} from '~/domain/board-animation'

describe('board-animation', () => {
  it('boardAnimationSettleMs covers Chessground animation plus a RAF tail buffer', () => {
    expect(boardAnimationSettleMs()).toBe(
      BOARD_MOVE_ANIMATION_DURATION_MS + BOARD_ANIMATION_TAIL_BUFFER_MS,
    )
  })
})
