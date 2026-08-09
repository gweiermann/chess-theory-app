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
  startSession: (lines: Line[], rng?: () => number) => void
  registerBoard: (instance: InstanceType<typeof ChessBoardComponent> | null) => void
  handleUserMove: (san: string, rng?: () => number) => Promise<void>
  requestHelp: () => void
  clearHint: () => void
  continueToNextRound: (rng?: () => number) => void
  rehydrateBoard: () => Promise<void>
}

let cached: RandomPractice | null = null

/** Mastered lines of the active practice session (for choosing the round side). */
let masteredLines: readonly Line[] = []

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** Pick a random mastered line to make this round's target line (drives the user's side + the "Ziel" label). */
const pickRoundLine = (rng: () => number): Line | null => {
  if (masteredLines.length === 0) return null
  const idx = Math.min(masteredLines.length - 1, Math.floor(rng() * masteredLines.length))
  return masteredLines[idx] ?? null
}

export const useRandomPractice = (): RandomPractice => {
  if (cached) return cached

  const tree = shallowRef<LearnedTree | null>(null)
  const session = shallowRef<RandomSessionState | null>(null)
  const board = ref<InstanceType<typeof ChessBoardComponent> | null>(null)
  const feedback = ref<FeedbackPayload | null>(null)
  const hintSans = ref<string[] | null>(null)
  const isComputerMoving = ref(false)

  let opponentInFlight = false
  let pendingUserMove: string | null = null

  const setBoardLocked = (locked: boolean): void => {
    board.value?.setLocked(locked)
  }

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
    opponentInFlight = true
    isComputerMoving.value = true
    setBoardLocked(true)
    let current = start
    while (current.phase === 'computer') {
      const san = pickComputerSan(current, rng)
      if (san) board.value?.playOpponentSan(san)
      current = computerMove(current, rng)
      await delay(COMPUTER_MOVE_DELAY_MS)
    }
    session.value = current
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

  const startSession = (lines: Line[], rng: () => number = Math.random): void => {
    masteredLines = lines
    if (lines.length === 0) {
      tree.value = null
      session.value = null
      feedback.value = null
      hintSans.value = null
      return
    }
    const t = buildLearnedTree(lines)
    tree.value = t
    const line = pickRoundLine(rng)
    if (!line) return
    beginNewRound(
      startRound({ tree: t, line }),
      rng,
    )
  }

  const continueToNextRound = (rng: () => number = Math.random): void => {
    const s = session.value
    const t = tree.value
    if (!s || !t) return
    const line = pickRoundLine(rng)
    if (!line) return
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
    setBoardLocked(true)
    setTimeout(() => {
      board.value?.undoLastMove()
      if (hintSans.value) board.value?.drawHintsForSans(hintSans.value)
      setBoardLocked(false)
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

    feedback.value = { kind: 'correct', played: san }
    hintSans.value = null
    clearBoardHints()

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
    startSession,
    registerBoard,
    handleUserMove,
    requestHelp,
    clearHint,
    continueToNextRound,
    rehydrateBoard,
  }
  return cached
}
