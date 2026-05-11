import { nextTick, ref, type ComputedRef, type Ref } from 'vue'
import type ChessBoardComponent from '~/components/ChessBoard.vue'
import type { TrainingSession } from '~/composables/training-session'
import { willMoveTriggerReset } from '~/domain/session'
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
}

export interface UseSessionFlow {
  hintActive: Ref<boolean>
  isResetting: Ref<boolean>
  setBoardLocked: (locked: boolean) => void
  clearHintArrow: () => void
  showHintForExpected: () => boolean
  /** Aufbau (`building`): auto-draw hint before every expected user move. Intro unchanged (no auto hints). */
  showBuildingUserHint: () => void
  /** @deprecated Use {@link showBuildingUserHint}; kept for callers that relied on this name. */
  showHintIfNewStep: () => void
  playOpponentIfNeeded: () => Promise<void>
  resetBoardForNextAttempt: () => Promise<void>
  replayPrefixOntoBoard: () => void
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
  demonstratedSteps: _demonstratedSteps,
  board,
  flowLocked,
  isReplayMode,
  resetReplayView,
  opponentDelayMs = 350,
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
    const line = currentLine.value
    if (!s || !line) return false
    // `expectedSan` is the next ply in the line; on opponent plies the user
    // is not expected to move (auto-play). Showing a hint would mark the
    // opponent's reply as the "help" move.
    if (isOpponentPly(line, s.state.value.expectedMoveIndex)) return false
    const san = s.state.value.expectedSan
    if (!san) return false
    const ok = board.value?.drawHintForSan(san) ?? false
    if (ok) hintActive.value = true
    return ok
  }

  const showBuildingUserHint = (): void => {
    const s = session.value
    const line = currentLine.value
    if (!s || !line) return
    const st = s.state.value
    if (st.phase !== 'building') return
    const san = st.expectedSan
    if (!san) return
    if (isOpponentPly(line, st.expectedMoveIndex)) return
    showHintForExpected()
  }

  const showHintIfNewStep = (): void => {
    showBuildingUserHint()
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
  const replayPrefixOntoBoard = (): void => {
    const line = currentLine.value
    const s = session.value
    if (!line || !s) return
    const prefix = s.state.value.prefixPlies
    if (prefix <= 0) return
    for (let i = 0; i < prefix; i += 1) {
      const san = line.sanMoves[i]
      if (!san) break
      board.value?.playOpponentSan(san)
    }
  }

  const resetBoardForNextAttempt = async (): Promise<void> => {
    isResetting.value = true
    clearHintArrow()
    board.value?.reset()
    await nextTick()
    replayPrefixOntoBoard()
    isResetting.value = false
    await playOpponentIfNeeded()
    showBuildingUserHint()
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
    board.value?.reset()
    await nextTick()
    const idx = s.state.value.expectedMoveIndex
    for (let i = 0; i < idx; i += 1) {
      const san = line.sanMoves[i]
      if (!san) break
      board.value?.playOpponentSan(san)
    }
    await nextTick()
    showBuildingUserHint()
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
    showBuildingUserHint,
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
