import { computed, nextTick, ref, type ComputedRef, type Ref } from 'vue'
import type ChessBoardComponent from '~/components/ChessBoard.vue'
import type { TrainingSession } from '~/composables/training-session'
import type { Line } from '~/domain/types'

type BoardRef = Ref<InstanceType<typeof ChessBoardComponent> | null>

interface UseReplayControlsArgs {
  session: Ref<TrainingSession | null>
  currentLine: Ref<Line | null>
  board: BoardRef
  flowLocked: Ref<boolean>
  /** Clears user hint state when stepping through move history (board + UI). */
  onReplayNavigation?: () => void
}

export interface UseReplayControls {
  viewedPly: Ref<number | null>
  maxReplayPly: ComputedRef<number>
  activeReplayPly: ComputedRef<number>
  isReplayMode: ComputedRef<boolean>
  canGoBackward: ComputedRef<boolean>
  canGoForward: ComputedRef<boolean>
  goMoveHistory: (delta: -1 | 1) => Promise<void>
  resetView: () => void
}

/**
 * Step the chessboard one ply forward or backward through the CURRENT
 * game's move history (replaying or undoing the SAN that was actually
 * played), bounded by the live position so we never reveal unlearned
 * moves. We animate backward via `undoLastMove` so the pieces visually
 * return to their previous squares – just replaying forward to ply-1
 * would animate the SECOND-TO-LAST move and look like a forward motion.
 */
export const useReplayControls = ({
  session,
  currentLine,
  board,
  flowLocked,
  onReplayNavigation,
}: UseReplayControlsArgs): UseReplayControls => {
  const viewedPly = ref<number | null>(null)

  const maxReplayPly = computed(
    () => session.value?.state.value.expectedMoveIndex ?? 0,
  )
  const activeReplayPly = computed(() => viewedPly.value ?? maxReplayPly.value)
  const isReplayMode = computed(() => activeReplayPly.value < maxReplayPly.value)
  const canGoBackward = computed(() => activeReplayPly.value > 0)
  const canGoForward = computed(() => activeReplayPly.value < maxReplayPly.value)

  const goMoveHistory = async (delta: -1 | 1): Promise<void> => {
    const max = maxReplayPly.value
    const current = activeReplayPly.value
    const next = Math.min(Math.max(current + delta, 0), max)
    if (next === current) return

    onReplayNavigation?.()

    const line = currentLine.value
    if (!line) return

    if (next < current) {
      for (let i = 0; i < current - next; i += 1) {
        board.value?.undoLastMove()
        await nextTick()
      }
    } else {
      for (let i = current; i < next; i += 1) {
        const san = line.sanMoves[i]
        if (!san) break
        board.value?.playOpponentSan(san)
        await nextTick()
      }
    }

    viewedPly.value = next === max ? null : next
    board.value?.setLocked(flowLocked.value || isReplayMode.value)
  }

  const resetView = (): void => {
    viewedPly.value = null
  }

  return {
    viewedPly,
    maxReplayPly,
    activeReplayPly,
    isReplayMode,
    canGoBackward,
    canGoForward,
    goMoveHistory,
    resetView,
  }
}
