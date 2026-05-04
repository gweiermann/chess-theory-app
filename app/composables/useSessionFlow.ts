import { nextTick, ref, type ComputedRef, type Ref } from 'vue'
import type ChessBoardComponent from '~/components/ChessBoard.vue'
import type { TrainingSession } from '~/composables/training-session'
import { isNewStepMove, willMoveTriggerReset } from '~/domain/session'
import { isOpponentPly } from '~/domain/training-turn'
import type { Line } from '~/domain/types'

type BoardRef = Ref<InstanceType<typeof ChessBoardComponent> | null>

interface UseSessionFlowArgs {
  session: Ref<TrainingSession | null>
  currentLine: Ref<Line | null>
  demonstratedSteps: Ref<Set<number>>
  board: BoardRef
  /** Shared with the caller (and `useReplayControls`) so the board lock state
   *  is the composite `flowLocked || isReplayMode`. */
  flowLocked: Ref<boolean>
  isReplayMode: ComputedRef<boolean>
  resetReplayView: () => void
  opponentDelayMs?: number
  prefixReplayDelayMs?: number
}

export interface UseSessionFlow {
  hintActive: Ref<boolean>
  isResetting: Ref<boolean>
  setBoardLocked: (locked: boolean) => void
  clearHintArrow: () => void
  showHintForExpected: () => boolean
  showHintIfNewStep: () => void
  playOpponentIfNeeded: () => Promise<void>
  resetBoardForNextAttempt: () => Promise<void>
  replayPrefixOntoBoard: (instant?: boolean) => Promise<void>
  rehydrateBoardFromSession: () => Promise<void>
  /** True while an opponent move is being submitted; user-moves should be buffered. */
  isOpponentInFlight: () => boolean
  /** Stash a user move that arrived during opponent in-flight (premove). */
  bufferUserMove: (san: string) => void
  /** Take and clear any buffered premove. */
  flushBufferedUserMove: () => string | null
}

/**
 * Owns the imperative drill-flow state — board ref, lock, hint arrow, opponent
 * auto-play and premove buffering. Stateless across line changes; callers
 * (the page) keep handling line lifecycle (start / next / restart / skip) and
 * just delegate the in-line drilling primitives here.
 */
export const useSessionFlow = ({
  session,
  currentLine,
  demonstratedSteps,
  board,
  flowLocked,
  isReplayMode,
  resetReplayView,
  opponentDelayMs = 350,
  prefixReplayDelayMs = 120,
}: UseSessionFlowArgs): UseSessionFlow => {
  const hintActive = ref(false)
  const isResetting = ref(false)
  let opponentInFlight = false
  let pendingUserMove: string | null = null

  const setBoardLocked = (locked: boolean): void => {
    flowLocked.value = locked
    board.value?.setLocked(flowLocked.value || isReplayMode.value)
  }

  const clearHintArrow = (): void => {
    if (!hintActive.value) return
    board.value?.clearHints()
    hintActive.value = false
  }

  const showHintForExpected = (): boolean => {
    const s = session.value
    if (!s) return false
    const san = s.state.value.expectedSan
    if (!san) return false
    const ok = board.value?.drawHintForSan(san) ?? false
    if (ok) hintActive.value = true
    return ok
  }

  const showHintIfNewStep = (): void => {
    const s = session.value
    if (!s) return
    if (!isNewStepMove(s.state.value)) return
    if (demonstratedSteps.value.has(s.state.value.currentStep)) return
    showHintForExpected()
  }

  const playOpponentIfNeeded = async (): Promise<void> => {
    const s = session.value
    const line = currentLine.value
    if (!s || !line) return
    const state = s.state.value
    if (
      state.phase !== 'intro'
      && state.phase !== 'building'
      && state.phase !== 'repeating'
    ) return
    if (!isOpponentPly(line, state.expectedMoveIndex)) return
    const opponentSan = line.sanMoves[state.expectedMoveIndex]
    if (!opponentSan) return

    const willReset = willMoveTriggerReset(state, opponentSan)

    opponentInFlight = true
    if (willReset) setBoardLocked(true)

    await new Promise((r) => setTimeout(r, opponentDelayMs))
    const ok = board.value?.playOpponentSan(opponentSan)
    if (!ok) {
      opponentInFlight = false
      pendingUserMove = null
      setBoardLocked(false)
      return
    }
    await s.submit(opponentSan)
    opponentInFlight = false
    if (willReset) setBoardLocked(false)

    // Drop a premove that landed during a reset boundary — it was made
    // against an outdated position. Otherwise leave the buffer for the
    // page to flush via flushBufferedUserMove().
    if (willReset) pendingUserMove = null

    // If the user pre-moved during the opponent turn, exit so the page can
    // flush that move through its own processUserMove pipeline; otherwise
    // the recursion below would push the session ahead of the queued premove.
    if (!willReset && pendingUserMove !== null && !isReplayMode.value) return

    resetReplayView()

    // Some black-side lines enter the next phase on an opponent move
    // boundary. Keep auto-playing until it is truly the user's turn.
    const nextState = s.state.value
    if (
      nextState.phase !== 'done'
      && isOpponentPly(line, nextState.expectedMoveIndex)
    ) {
      await playOpponentIfNeeded()
    }
  }

  /**
   * Auto-play the prefix plies (the parent's moves) onto the board in one go.
   * Used on every reset (step / rep change) AFTER the user has completed the
   * intro – the user should never have to replay the parent by hand during
   * a drill loop. Used at session start only when `skipIntro` is on.
   */
  const replayPrefixOntoBoard = async (instant = false): Promise<void> => {
    const line = currentLine.value
    const s = session.value
    if (!line || !s) return
    const prefix = s.state.value.prefixPlies
    if (prefix <= 0) return
    for (let i = 0; i < prefix; i += 1) {
      const san = line.sanMoves[i]
      if (!san) break
      board.value?.playOpponentSan(san)
      if (!instant && i < prefix - 1) {
        await new Promise((r) => setTimeout(r, prefixReplayDelayMs))
      }
    }
  }

  const resetBoardForNextAttempt = async (): Promise<void> => {
    isResetting.value = true
    clearHintArrow()
    board.value?.setAnimationEnabled(false)
    board.value?.reset()
    await nextTick()
    await replayPrefixOntoBoard(true)
    board.value?.setAnimationEnabled(true)
    isResetting.value = false
    await playOpponentIfNeeded()
    showHintIfNewStep()
    setBoardLocked(false)
  }

  /**
   * Replay the moves of the currently running session onto a freshly mounted
   * board. Used on tab re-entry so the user returns to the exact position
   * they left – without this the board would be empty while the session
   * thinks we are already several plies in.
   */
  const rehydrateBoardFromSession = async (): Promise<void> => {
    const line = currentLine.value
    const s = session.value
    if (!line || !s) return
    resetReplayView()
    setBoardLocked(true)
    await nextTick()
    await new Promise((r) => setTimeout(r, 50))
    board.value?.setAnimationEnabled(false)
    board.value?.reset()
    await nextTick()
    const idx = s.state.value.expectedMoveIndex
    for (let i = 0; i < idx; i += 1) {
      const san = line.sanMoves[i]
      if (!san) break
      board.value?.playOpponentSan(san)
    }
    await nextTick()
    board.value?.setAnimationEnabled(true)
    if (
      isNewStepMove(s.state.value)
      && !demonstratedSteps.value.has(s.state.value.currentStep)
    ) {
      showHintForExpected()
    }
    setBoardLocked(false)
  }

  const isOpponentInFlight = (): boolean => opponentInFlight

  const bufferUserMove = (san: string): void => {
    pendingUserMove = san
  }

  const flushBufferedUserMove = (): string | null => {
    const queued = pendingUserMove
    pendingUserMove = null
    return queued
  }

  return {
    hintActive,
    isResetting,
    setBoardLocked,
    clearHintArrow,
    showHintForExpected,
    showHintIfNewStep,
    playOpponentIfNeeded,
    resetBoardForNextAttempt,
    replayPrefixOntoBoard,
    rehydrateBoardFromSession,
    isOpponentInFlight,
    bufferUserMove,
    flushBufferedUserMove,
  }
}
