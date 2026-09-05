import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import type ChessBoardComponent from '~/components/ChessBoard.vue'
import type { FeedbackPayload } from '~/components/play/feedback-types'
import {
  buildLearnedTree,
  type LearnedTree,
} from '~/domain/random-trainer/learned-tree'
import {
  startRound,
  computerMove,
  submitUserMove,
  markHelp,
  pickComputerSan,
  type RandomSessionState,
} from '~/domain/random-trainer/random-session'
import { standardStartFen } from '~/domain/prefix-fen'
import type { Line } from '~/domain/types'
import type { MasteredLine } from '~/domain/random-trainer/mastered-pool'
import {
  decideNextFocus,
  groupByFamily,
  keepMaximal,
  pickInitialFamily,
  pickSideFamily,
  pickTargetLine,
  type FocusFamily,
  type FocusState,
} from '~/domain/random-trainer/focus'

type BoardRef = Ref<InstanceType<typeof ChessBoardComponent> | null>

/** Pause before the computer plays its next learned continuation. */
const COMPUTER_MOVE_DELAY_MS = 350
/** Brief lock so the user sees their illegal try before it is undone. */
const WRONG_UNDO_DELAY_MS = 200

export interface RandomPractice {
  tree: ShallowRef<LearnedTree | null>
  session: ShallowRef<RandomSessionState | null>
  board: BoardRef
  feedback: Ref<FeedbackPayload | null>
  /** Multi-answer hint list (shown on a wrong move and via Hilfe). */
  hintSans: Ref<string[] | null>
  isComputerMoving: Ref<boolean>
  /** True when every eligible target was completed first-try this session. */
  sessionExhausted: Ref<boolean>
  startSession: (lines: MasteredLine[], rng?: () => number) => void
  registerBoard: (instance: InstanceType<typeof ChessBoardComponent> | null) => void
  handleUserMove: (san: string, rng?: () => number) => Promise<void>
  requestHelp: () => void
  clearHint: () => void
  continueToNextRound: (rng?: () => number) => void
  /** User override: force the next round into a different focus family. */
  switchFocus: (rng?: () => number) => void
  rehydrateBoard: () => Promise<void>
}

let cached: RandomPractice | null = null

/** Maximal mastered content grouped by family (the focus pool). */
let families: FocusFamily[] = []
/** Session-local focus state — never persisted, fresh on every visit. */
let focusState: FocusState = { currentFamilyId: null, masteryByFamily: {} }
/** Id of the most recently targeted line, so consecutive rounds avoid a repeat within a family. */
let lastTargetId: string | null = null
/** Perfectly completed targets are excluded for this browser-session only. */
const completedFirstTryTargetIds = new Set<string>()

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** Focus families retaining at least one target not completed first-try. */

const nextAnimationFrame = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve()
      return
    }
    window.requestAnimationFrame(() => resolve())
  })
const eligibleFamilies = (): FocusFamily[] =>
  families.flatMap((family) => {
    const lines = family.lines.filter((line) => !completedFirstTryTargetIds.has(line.id))
    return lines.length > 0 ? [{ ...family, lines }] : []
  })

/** Random eligible maximal line within the current focus family. */
const pickTargetInFocus = (rng: () => number): Line | null => {
  const family = eligibleFamilies().find((item) => item.id === focusState.currentFamilyId)
  if (!family) return null
  return pickTargetLine(family, rng, lastTargetId ?? undefined)
}

/** Set the focus family of record (no round starts). */
const assignFocus = (familyId: string | null): void => {
  focusState = { ...focusState, currentFamilyId: familyId }
}

export const useRandomPractice = (): RandomPractice => {
  if (cached) return cached

  const tree = shallowRef<LearnedTree | null>(null)
  const session = shallowRef<RandomSessionState | null>(null)
  const board = ref<InstanceType<typeof ChessBoardComponent> | null>(null)
  const feedback = ref<FeedbackPayload | null>(null)
  const hintSans = ref<string[] | null>(null)
  const isComputerMoving = ref(false)
  const sessionExhausted = ref(false)

  let opponentInFlight = false
  let pendingUserMove: string | null = null

  const setBoardLocked = (locked: boolean): void => {
    board.value?.setLocked(locked)
  }

  /** Resolve once the board component has been registered (ready) or after a
   *  short grace period, so driveComputer never plays into a null board. */
  const whenBoardReady = (): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      const deadline = Date.now() + 3000
      const check = (): void => {
        if (board.value || Date.now() > deadline) {
          resolve(Boolean(board.value))
          return
        }
        window.setTimeout(check, 16)
      }
      check()
    })

  const beginNewRound = (
    initial: RandomSessionState,
    rng: () => number,
  ): void => {
    session.value = initial
    feedback.value = null
    hintSans.value = null
    clearBoardHints()
    board.value?.setPositionFromFen(standardStartFen())
    if (initial.phase === 'computer') void driveComputer(rng, initial)
  }

  const driveComputer = async (
    rng: () => number,
    fromSession: RandomSessionState | null = null,
  ): Promise<void> => {
    const start = fromSession ?? session.value
    if (!start || start.phase !== 'computer') return
    // A freshly started round (e.g. the user is Black and White opens) can
    // reach here before the board's `ready` event has registered it. Playing
    // into a null board would silently drop White's first move and strand the
    // session on the user's turn with an empty board. Wait for it, briefly.
    await whenBoardReady()
    if (!board.value) return
    opponentInFlight = true
    isComputerMoving.value = true
    setBoardLocked(true)
    let current = start
    while (current.phase === 'computer') {
      const san = pickComputerSan(current, rng)
      if (san) {
        // Dev-bridge moves advance the session without touching Chessground.
        // Snap that missing user move without animation and let the browser
        // render it before enabling animation for the opponent reply. Calling
        // both mutations in one animated frame makes Chessground animate two
        // pieces at once (the visible flicker users reported). On a real board
        // move the board already equals node.fen, so the snap is a no-op.
        const snapped = board.value.setPositionFromFen(current.node.fen, false)
        if (snapped) {
          await nextAnimationFrame()
          board.value.setMoveAnimationEnabled(true)
        }
        board.value.playOpponentSan(san)
      }
      current = computerMove(current, rng)
      await delay(COMPUTER_MOVE_DELAY_MS)
    }
    session.value = current
    recordFirstTryTarget(current)
    opponentInFlight = false
    isComputerMoving.value = false
    setBoardLocked(false)
    if (current.phase === 'round-complete') {
      feedback.value = null
      hintSans.value = null
      clearBoardHints()
      return
    }
    // Flush a premove that landed while the computer was moving.
    const queued = pendingUserMove
    pendingUserMove = null
    if (queued !== null) void handleUserMove(queued, rng)
  }

  const clearBoardHints = (): void => {
    board.value?.clearHints()
  }

  const recordFirstTryTarget = (completed: RandomSessionState): void => {
    if (
      completed.phase === 'round-complete' &&
      completed.lastRound?.targetMet &&
      !completed.lastRound.helpUsed
    ) {
      completedFirstTryTargetIds.add(completed.targetId)
      sessionExhausted.value = eligibleFamilies().length === 0
    }
  }

  const ensureEligibleFocus = (
    eligible: readonly FocusFamily[],
    rng: () => number,
  ): void => {
    if (eligible.some((family) => family.id === focusState.currentFamilyId)) return
    assignFocus(pickInitialFamily(eligible, rng).id)
  }

  const startSession = (lines: MasteredLine[], rng: () => number = Math.random): void => {
    completedFirstTryTargetIds.clear()
    sessionExhausted.value = false
    if (lines.length === 0) {
      families = []
      focusState = { currentFamilyId: null, masteryByFamily: {} }
      lastTargetId = null
      tree.value = null
      session.value = null
      feedback.value = null
      hintSans.value = null
      return
    }
    const t = buildLearnedTree(lines)
    tree.value = t
    // Only the longest known lines are ever offered as round targets; the
    // tree above keeps every mastered line as a valid continuation.
    families = groupByFamily(keepMaximal(lines))
    focusState = { currentFamilyId: null, masteryByFamily: {} }
    lastTargetId = null
    const initial = pickInitialFamily(families, rng)
    assignFocus(initial.id)
    const line = pickTargetInFocus(rng) ?? initial.lines[0] ?? null
    if (!line) return
    lastTargetId = line.id
    beginNewRound(
      startRound({ tree: t, line }),
      rng,
    )
  }

  const continueToNextRound = (rng: () => number = Math.random): void => {
    const s = session.value
    const t = tree.value
    if (!s || !t || sessionExhausted.value) return
    const eligible = eligibleFamilies()
    if (eligible.length === 0) {
      sessionExhausted.value = true
      return
    }
    ensureEligibleFocus(eligible, rng)
    const decided = decideNextFocus(
      focusState,
      eligible,
      {
        targetMet: s.lastRound?.targetMet ?? false,
        mistakes: s.lastRound?.mistakes ?? 0,
      },
      rng,
    )
    focusState = decided.next
    const line = pickTargetInFocus(rng)
    if (!line) return
    lastTargetId = line.id
    beginNewRound(
      startRound({
        tree: t,
        line,
        from: {
          score: s.score,
          streak: s.streak,
          roundNumber: s.roundNumber,
        },
      }),
      rng,
    )
  }

  /** User override: jump to a different focus family and start a new round. */
  const switchFocus = (rng: () => number = Math.random): void => {
    const s = session.value
    const t = tree.value
    if (!s || !t || sessionExhausted.value) return
    const eligible = eligibleFamilies()
    if (eligible.length === 0) {
      sessionExhausted.value = true
      return
    }
    ensureEligibleFocus(eligible, rng)
    const other = pickSideFamily(eligible, focusState.currentFamilyId ?? '', rng)
    if (other) assignFocus(other.id)
    const line = pickTargetInFocus(rng)
    if (!line) return
    lastTargetId = line.id
    beginNewRound(
      startRound({
        tree: t,
        line,
        from: {
          score: s.score,
          streak: s.streak,
          roundNumber: s.roundNumber,
        },
      }),
      rng,
    )
  }

  const handleWrongMove = (): void => {
    // The board must return to the session node position, not simply "undo one
    // board move". A wrong move submitted through the dev bridge never reached
    // the physical board, so undoLastMove would pop an unrelated earlier move
    // and permanently desync the board from the session. Snapping to node.fen
    // is correct whether or not the wrong move was ever placed on the board.
    const nodeFen = session.value?.node.fen ?? ''
    setBoardLocked(true)
    setTimeout(() => {
      // Only restore if the session is still on this node. The user can
      // recover via the dev bridge within the undo window — a correct move
      // advances the node before this timer fires, and restoring the stale
      // FEN captured here would clobber the correct move's board position
      // (and unlocking mid-reply would race the computer's turn). On the
      // physical board the board is locked during this window, so the user
      // can't advance early and the restore always applies.
      if (session.value?.node.fen === nodeFen) {
        board.value?.setPositionFromFen(nodeFen)
        if (hintSans.value) board.value?.drawHintsForSans(hintSans.value)
        setBoardLocked(false)
      }
    }, WRONG_UNDO_DELAY_MS)
  }

  const handleUserMove = async (
    san: string,
    rng: () => number = Math.random,
  ): Promise<void> => {
    if (opponentInFlight) {
      pendingUserMove = san
      return
    }
    const s = session.value
    if (!s || s.phase !== 'user') return

    const result = submitUserMove(s, san)
    session.value = result.state

    if (result.outcome.kind === 'wrong') {
      const continuations = result.outcome.continuations
      feedback.value = {
        kind: 'wrong',
        played: san,
        continuations,
      }
      hintSans.value = continuations
      board.value?.drawHintsForSans(continuations)
      handleWrongMove()
      return
    }

    feedback.value = null
    hintSans.value = null
    clearBoardHints()
    recordFirstTryTarget(result.state)

    if (result.state.phase === 'computer') {
      await driveComputer(rng)
    }
  }

  const requestHelp = (): void => {
    const s = session.value
    if (!s || s.phase !== 'user') return
    session.value = markHelp(s)
    const continuations = [...s.node.edges.keys()]
    if (continuations.length === 0) return
    hintSans.value = continuations
    board.value?.drawHintsForSans(continuations)
  }

  const clearHint = (): void => {
    hintSans.value = null
    clearBoardHints()
  }

  const rehydrateBoard = async (): Promise<void> => {
    const s = session.value
    if (!s) return
    await delay(50)
    board.value?.setPositionFromFen(s.node.fen)
    if (s.phase === 'computer') void driveComputer(Math.random)
  }

  const registerBoard = (
    instance: InstanceType<typeof ChessBoardComponent> | null,
  ): void => {
    board.value = instance
  }

  cached = {
    tree,
    session,
    board,
    feedback,
    hintSans,
    isComputerMoving,
    sessionExhausted,
    startSession,
    registerBoard,
    handleUserMove,
    requestHelp,
    clearHint,
    continueToNextRound,
    switchFocus,
    rehydrateBoard,
  }
  return cached
}
