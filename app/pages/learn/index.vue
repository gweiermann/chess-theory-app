<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTopic } from '~/composables/useTopic'
import { useTopicProgress } from '~/composables/useTopicProgress'
import { useCurrentSelection } from '~/composables/useCurrentSelection'
import { useLearnState } from '~/composables/useLearnState'
import {
  createTrainingSession,
} from '~/composables/training-session'
import { useProfileSettings } from '~/composables/useProfileSettings'
import { findParentLine, selectLineForFocus } from '~/domain/select-next-line'
import { isNewStepMove, TARGET_REPS } from '~/domain/session'
import {
  MISTAKE_BANNER_TEXT,
  bannerForResetReason,
  getResetReason,
  willMoveTriggerReset,
  type BannerKind,
  type PhaseMarkers,
  type ResetReason,
} from '~/domain/learn-banner'
import type { Line, LineProgress, Topic } from '~/domain/types'
import type ChessBoardComponent from '~/components/ChessBoard.vue'

const OPPONENT_DELAY_MS = 350
const STEP_RESET_DELAY_MS = 600
const NEXT_LINE_DELAY_MS = 1500
const MISTAKE_BANNER_MS = 1800
const PREFIX_REPLAY_DELAY_MS = 120

const BANNER_PRESETS: Record<BannerKind, { classes: string; icon: string }> = {
  'hint': {
    classes: 'border-(--ui-primary)/30 bg-(--ui-primary)/10 text-(--ui-primary)',
    icon: 'i-lucide-lightbulb',
  },
  'memory': {
    classes: 'border-(--ui-info)/30 bg-(--ui-info)/10 text-(--ui-info)',
    icon: 'i-lucide-brain',
  },
  'setup-complete': {
    classes: 'border-(--ui-success)/30 bg-(--ui-success)/10 text-(--ui-success)',
    icon: 'i-lucide-check-circle-2',
  },
  'motivation': {
    classes: 'border-(--ui-success)/30 bg-(--ui-success)/10 text-(--ui-success)',
    icon: 'i-lucide-sparkles',
  },
  'mistake': {
    classes: 'border-(--ui-error)/30 bg-(--ui-error)/10 text-(--ui-error)',
    icon: 'i-lucide-alert-circle',
  },
}

const router = useRouter()
const { $repositories } = useNuxtApp()
const { selection, set: setSelection } = useCurrentSelection()
const learnState = useLearnState()
const { autoPlayParentPrefix } = useProfileSettings()

const topicIdRef = computed(() => selection.value?.topicId ?? null)
const { topic, loading, error } = useTopic(topicIdRef)

const {
  currentLine,
  parentLine,
  session,
  demonstratedSteps,
  banner,
  allMastered,
} = learnState

const board = ref<InstanceType<typeof ChessBoardComponent> | null>(null)
const progressApi = shallowRef<ReturnType<typeof useTopicProgress> | null>(null)
const isResetting = ref(false)
const hintActive = ref(false)
const showInfoModal = ref(false)
const showActionSheet = ref(false)
const flowLocked = ref(false)
const viewedPly = ref<number | null>(null)
let mistakeTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Premove buffer. Chessground auto-applies a queued premove SYNCHRONOUSLY
 * inside `api.move(opponentSan)`, firing our `user-move` event BEFORE we
 * `await s.submit(opponentSan)`. Naively forwarding that event would race
 * the opponent's submit. We buffer premoves during opponent turns instead
 * and flush them after the opponent move has been persisted.
 */
let opponentInFlight = false
let pendingUserMove: string | null = null

const bannerPreset = computed(() =>
  banner.value ? BANNER_PRESETS[banner.value.kind] : null,
)

const currentFamily = computed(() => {
  const line = currentLine.value
  const t = topic.value
  if (!line || !t) return null
  return t.families.find((f) => f.lines.some((l) => l.id === line.id)) ?? null
})

const focusedFamilyName = computed(() => {
  const sel = selection.value
  const t = topic.value
  if (!sel || !t) return null
  const focus = sel.focus
  if (focus.kind === 'family') {
    return t.families.find((f) => f.id === focus.familyId)?.name ?? null
  }
  return currentFamily.value?.name ?? null
})

const maxReplayPly = computed(() => session.value?.state.value.expectedMoveIndex ?? 0)
const activeReplayPly = computed(() => viewedPly.value ?? maxReplayPly.value)
const isReplayMode = computed(() => activeReplayPly.value < maxReplayPly.value)

const canGoBackward = computed(() => activeReplayPly.value > 0)
const canGoForward = computed(
  () => activeReplayPly.value < maxReplayPly.value,
)

const isOpponentTurn = (line: Line, expectedIndex: number): boolean => {
  if (expectedIndex >= line.sanMoves.length) return false
  const moveSide = expectedIndex % 2 === 0 ? 'white' : 'black'
  return moveSide !== line.userSide
}

const cancelMistakeTimer = (): void => {
  if (mistakeTimer !== null) {
    clearTimeout(mistakeTimer)
    mistakeTimer = null
  }
}

const setBoardLocked = (locked: boolean): void => {
  flowLocked.value = locked
  board.value?.setLocked(flowLocked.value || isReplayMode.value)
}

const setBanner = (kind: BannerKind, text: string): void => {
  cancelMistakeTimer()
  banner.value = { kind, text }
}

const clearBanner = (): void => {
  cancelMistakeTimer()
  banner.value = null
}

/**
 * Clear only banner kinds that should disappear on the next successful move
 * (the hint and mistake banners). The "memory", "setup-complete" and
 * "motivation" banners must survive individual moves so the user keeps
 * seeing the context while they replay moves from memory.
 */
const clearEphemeralBanner = (): void => {
  const current = banner.value
  if (!current) return
  if (current.kind === 'hint' || current.kind === 'mistake') {
    clearBanner()
  }
}

const clearHintArrow = (): void => {
  if (!hintActive.value) return
  board.value?.clearHints()
  hintActive.value = false
}

const clearHint = (): void => {
  clearHintArrow()
  clearBanner()
}

const showHintForExpected = (bannerText: string | null = null): boolean => {
  const s = session.value
  if (!s) return false
  const san = s.state.value.expectedSan
  if (!san) return false
  const ok = board.value?.drawHintForSan(san) ?? false
  if (ok) {
    hintActive.value = true
    if (bannerText !== null) setBanner('hint', bannerText)
  }
  return ok
}

const formatBannerForSan = (prefix: string, san: string | null): string => {
  if (!san) return prefix
  return `${prefix}: ${san}`
}

const showHintIfNewStep = (): void => {
  const s = session.value
  if (!s) return
  if (!isNewStepMove(s.state.value)) return
  if (demonstratedSteps.value.has(s.state.value.currentStep)) return
  const san = s.state.value.expectedSan
  showHintForExpected(formatBannerForSan('Neuer Zug – probiere ihn aus', san))
}

const showMistakeBanner = (): void => {
  setBanner('mistake', MISTAKE_BANNER_TEXT)
  mistakeTimer = setTimeout(() => {
    mistakeTimer = null
    if (banner.value?.kind === 'mistake') banner.value = null
  }, MISTAKE_BANNER_MS)
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
  if (!isOpponentTurn(line, state.expectedMoveIndex)) return
  const opponentSan = line.sanMoves[state.expectedMoveIndex]
  if (!opponentSan) return

  // Will this opponent move push the session across a reset boundary
  // (next step / next rep / phase change)? If so we must NOT let the user
  // premove across the reset - any queued premove is discarded.
  const willReset = willMoveTriggerReset(state, opponentSan)

  opponentInFlight = true
  // When the opponent move would trigger a reset, lock the board fully so
  // chessground cannot even queue a premove. Otherwise we keep the board
  // in its current state so the user can click a piece and have chessground
  // queue it as a ghost premove that gets auto-applied right after the
  // opponent's move lands. The premove fires our `user-move` synchronously
  // - `opponentInFlight` causes that handler to buffer instead of race.
  if (willReset) setBoardLocked(true)

  await new Promise((r) => setTimeout(r, OPPONENT_DELAY_MS))
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

  // Flush any premove that was auto-applied on the board while the opponent
  // was moving. Drop the buffer outright if the opponent's move just reset
  // the session (the premove was made against an outdated position).
  const queued = pendingUserMove
  pendingUserMove = null
  if (!willReset && queued !== null && !isReplayMode.value) {
    await processUserMove(queued)
    return
  }

  // Reset the viewed ply after a successful opponent move.
  viewedPly.value = null

  // Some black-side lines enter the next phase on an opponent move
  // boundary. Keep auto-playing until it is truly the user's turn.
  const nextState = s.state.value
  if (
    nextState.phase !== 'done'
    && isOpponentTurn(line, nextState.expectedMoveIndex)
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
const replayPrefixOntoBoard = async (): Promise<void> => {
  const line = currentLine.value
  const s = session.value
  if (!line || !s) return
  const prefix = s.state.value.prefixPlies
  if (prefix <= 0) return
  for (let i = 0; i < prefix; i += 1) {
    const san = line.sanMoves[i]
    if (!san) break
    board.value?.playOpponentSan(san)
    // Pause between plies so the user can see the setup animate instead of
    // all pieces jumping into place at once.
    if (i < prefix - 1) {
      await new Promise((r) => setTimeout(r, PREFIX_REPLAY_DELAY_MS))
    }
  }
}

const markers = (): PhaseMarkers | null => {
  const s = session.value
  if (!s) return null
  const st = s.state.value
  return {
    phase: st.phase,
    currentStep: st.currentStep,
    repsDone: st.repsDone,
  }
}

const resetBoardForNextAttempt = async (
  reason: ResetReason | null = null,
): Promise<void> => {
  isResetting.value = true
  clearHintArrow()
  const after = markers()
  if (reason !== null && after !== null) {
    const next = bannerForResetReason(reason, after)
    setBanner(next.kind, next.text)
  } else {
    clearBanner()
  }
  board.value?.reset()
  await nextTick()
  // Auto-play the prefix so the user starts the next rep/step FROM the
  // parent position instead of the empty board.
  await replayPrefixOntoBoard()
  isResetting.value = false
  await playOpponentIfNeeded()
  showHintIfNewStep()
  setBoardLocked(false)
}

/**
 * Compose the intro banner text. Real parent lines get the full name
 * ("Spiele die Eröffnung 'X' bis zur Grundposition"). For lines whose only
 * prefix is the topic's own first move (e.g. e4) we surface a terser
 * prompt asking the user to play that one move.
 */
const introBannerText = (
  t: Topic,
  parent: Line | null,
  prefixPlies: number,
  firstSan: string | null,
): string => {
  if (parent) {
    return `Spiele die Eröffnung "${parent.fullName}" bis zur Grundposition`
  }
  if (prefixPlies === 1 && firstSan) {
    return `Spiele den Eröffnungszug ${firstSan}`
  }
  return `Spiele die ersten ${prefixPlies} Züge von ${t.label}`
}

const startLine = (
  t: Topic,
  line: Line,
): void => {
  showActionSheet.value = false
  showInfoModal.value = false
  viewedPly.value = null
  pendingUserMove = null
  opponentInFlight = false
  currentLine.value = line
  const progress = progressApi.value?.progress.value ?? []
  const parent = findParentLine(t, line, progress)
  parentLine.value = parent
  const hasRealParent =
    !!parent
    && parent.sanMoves.length > 0
    && parent.sanMoves.length < line.sanMoves.length

  // Treat the topic's own first move (e.g. "1.e4") as an implicit parent
  // when no real parent has been mastered: every e4 line shares that
  // opening move, so it acts as a minimal "play to setup" step.
  const hasVirtualFirstMoveParent =
    !hasRealParent
    && line.sanMoves.length > 1
    && !!t.firstMove
    && line.sanMoves[0] === t.firstMove

  const prefixPlies = hasRealParent
    ? parent!.sanMoves.length
    : hasVirtualFirstMoveParent
      ? 1
      : 0

  // A parent is defined by its USER moves being a prefix of the child's
  // user moves. For defenses (userSide=black) the first ply belongs to
  // the opponent, so the "virtual" single-ply prefix is not something
  // the user can play by hand – skip the intro in that case. Real
  // parents always share userSide and are valid intro candidates.
  const introIsPlayable =
    hasRealParent
    || (hasVirtualFirstMoveParent && line.userSide === 'white')

  // The intro phase prompts the user to play the prefix moves by hand so
  // they reach the parent's base position from memory. The /profile toggle
  // `autoPlayParentPrefix` skips this manual walkthrough and auto-plays
  // the prefix instead – intended for experienced users who already know
  // the parent inside out.
  const runsIntro = introIsPlayable && prefixPlies > 0 && !autoPlayParentPrefix.value
  const skipIntro = !runsIntro

  const repo = $repositories.createProgressRepository(t)
  const activityRecorder = {
    topicId: t.id,
    record: (event: Parameters<typeof $repositories.activity.append>[0]) =>
      $repositories.activity.append(event),
  }
  session.value = createTrainingSession({
    line,
    repo,
    activityRecorder,
    prefixPlies,
    skipIntro,
  })
  demonstratedSteps.value = new Set()
  clearHint()
  setBoardLocked(true)

  if (runsIntro) {
    setBanner(
      'memory',
      introBannerText(t, hasRealParent ? parent : null, prefixPlies, line.sanMoves[0] ?? null),
    )
  }

  setTimeout(async () => {
    board.value?.reset()
    await nextTick()
    if (skipIntro && prefixPlies > 0) {
      await replayPrefixOntoBoard()
    }
    await playOpponentIfNeeded()
    // showHintIfNewStep is a no-op during intro (isNewStepMove checks for
    // building phase), so it's safe to call unconditionally. When intro
    // runs and the opponent auto-plays its way into building (e.g. a
    // defense where the opening first move is white's), this arms the
    // first arrow automatically.
    showHintIfNewStep()
    setBoardLocked(false)
  }, 50)
}

/**
 * When the user has just finished ("mastered" or "skipped") the current
 * line, but their selection still points EXACTLY at that line (often with
 * the `exclusive` flag set after navigating via the previous/parent
 * button), the next `selectLineForFocus` call would return the same
 * mastered line and progression would stall. Broaden the selection to
 * the containing family so we always advance.
 */
const broadenSelectionAfterCompletion = (): void => {
  const sel = selection.value
  const t = topic.value
  const line = currentLine.value
  if (!sel || !t || !line) return
  if (sel.focus.kind !== 'line') return
  if (sel.focus.lineId !== line.id) return
  const family = t.families.find((f) => f.lines.some((l) => l.id === line.id))
  if (!family) return
  setSelection({
    topicId: t.id,
    focus: { kind: 'family', familyId: family.id },
  })
}

const startNextLine = (t: Topic): void => {
  if (!progressApi.value || !selection.value) {
    allMastered.value = false
    currentLine.value = null
    parentLine.value = null
    session.value = null
    return
  }
  const next = selectLineForFocus(
    t,
    selection.value.focus,
    progressApi.value.progress.value,
  )
  if (!next) {
    allMastered.value = true
    currentLine.value = null
    parentLine.value = null
    session.value = null
    return
  }
  allMastered.value = false
  startLine(t, next)
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
  viewedPly.value = null
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
  if (isNewStepMove(s.state.value) && !demonstratedSteps.value.has(s.state.value.currentStep)) {
    const san = s.state.value.expectedSan
    showHintForExpected(formatBannerForSan('Neuer Zug – probiere ihn aus', san))
  }
  setBoardLocked(false)
}

watch(
  topic,
  async (t) => {
    if (!t) {
      progressApi.value = null
      return
    }
    progressApi.value = useTopicProgress(t)
    await progressApi.value.refresh()
    // If there is already a running session for a line that belongs to this
    // topic AND still matches the current focus, keep it alive and just
    // rehydrate the board. Otherwise start (or continue) with the next line
    // the selection points at.
    const existing = currentLine.value
    const runningBelongsToTopic = !!existing
      && t.families.some((f) => f.lines.some((l) => l.id === existing.id))
    const focusStillPoints = runningBelongsToTopic
      && !!selectionPointsAt(existing!)
    if (runningBelongsToTopic && focusStillPoints && session.value) {
      await rehydrateBoardFromSession()
      return
    }
    startNextLine(t)
  },
  { immediate: true },
)

/**
 * True if the current `selection` still ultimately resolves to {@link line}.
 * We compare by line id because a focus of kind 'topic' or 'family' can
 * legitimately land on many lines – what matters is whether the running
 * session would be the next pick right now.
 */
const selectionPointsAt = (line: Line): boolean => {
  const t = topic.value
  const sel = selection.value
  const progress = progressApi.value?.progress.value ?? []
  if (!t || !sel) return false
  if (sel.topicId !== t.id) return false
  const focus = sel.focus
  if (focus.kind === 'line' && focus.lineId === line.id) return true
  const next = selectLineForFocus(t, focus, progress)
  return next?.id === line.id
}

watch(
  () => selection.value,
  async (sel) => {
    if (!sel || !topic.value || topic.value.id !== sel.topicId) return
    if (!progressApi.value) return
    await progressApi.value.refresh()
    const existing = currentLine.value
    if (
      existing
      && sel.focus.kind === 'line'
      && sel.focus.lineId === existing.id
      && session.value
    ) {
      // Same line – nothing to do, keep the session running.
      return
    }
    startNextLine(topic.value)
  },
)

const finalizeMastery = (): void => {
  if (!currentLine.value || !progressApi.value) return
  progressApi.value.progress.value = progressApi.value.progress.value
    .filter((p) => p.lineId !== currentLine.value!.id)
    .concat([{
      lineId: currentLine.value.id,
      status: 'mastered',
      reps: TARGET_REPS,
      lastPracticedAt: Date.now(),
    }])
}

const handleUserMove = async (san: string): Promise<void> => {
  if (isReplayMode.value) return
  if (opponentInFlight) {
    // The user pre-moved while the opponent was moving. Buffer it through
    // our submit pipeline instead of letting it race the opponent's submit.
    pendingUserMove = san
    return
  }
  await processUserMove(san)
}

const processUserMove = async (san: string): Promise<void> => {
  if (isResetting.value) return
  const s = session.value
  const line = currentLine.value
  if (!s || !line) return

  const before = markers()
  if (!before) return
  const wasNewStepMove = isNewStepMove(s.state.value)
  const result = await s.submit(san)

  if (result.result === 'wrong') {
    showMistakeBanner()
    setBoardLocked(true)
    setTimeout(() => {
      board.value?.undoLastMove()
      setBoardLocked(false)
    }, 200)
    return
  }

  clearHintArrow()
  clearEphemeralBanner()
  if (wasNewStepMove) demonstratedSteps.value.add(before.currentStep)

  const afterUser = markers()!

  if (afterUser.phase === 'done') {
    finalizeMastery()
    broadenSelectionAfterCompletion()
    setBoardLocked(true)
    setTimeout(() => topic.value && startNextLine(topic.value), NEXT_LINE_DELAY_MS)
    return
  }

  const reasonAfterUser = getResetReason(before, afterUser)
  if (reasonAfterUser !== null) {
    setBoardLocked(true)
    setTimeout(() => resetBoardForNextAttempt(reasonAfterUser), STEP_RESET_DELAY_MS)
    return
  }

  await playOpponentIfNeeded()

  const afterOpponent = markers()!
  if (afterOpponent.phase === 'done') {
    finalizeMastery()
    broadenSelectionAfterCompletion()
    setBoardLocked(true)
    setTimeout(() => topic.value && startNextLine(topic.value), NEXT_LINE_DELAY_MS)
    return
  }

  const reasonAfterOpponent = getResetReason(before, afterOpponent)
  if (reasonAfterOpponent !== null) {
    setBoardLocked(true)
    setTimeout(() => resetBoardForNextAttempt(reasonAfterOpponent), STEP_RESET_DELAY_MS)
    return
  }

  showHintIfNewStep()
}

const skipLine = () => {
  if (!topic.value || !currentLine.value || !progressApi.value) return
  showActionSheet.value = false
  const t = topic.value
  const skipped: LineProgress = {
    lineId: currentLine.value.id,
    status: 'mastered',
    reps: TARGET_REPS,
    lastPracticedAt: Date.now(),
  }
  // Persist to the repository BEFORE broadening the selection. Broadening
  // triggers the selection watcher which calls progressApi.refresh() that
  // re-reads from localStorage – without persistence first, refresh would
  // wipe the in-memory mastery and progression would stall on the just-
  // skipped line.
  const repo = $repositories.createProgressRepository(t)
  void repo.saveLine(skipped)
  progressApi.value.progress.value = progressApi.value.progress.value
    .filter((p) => p.lineId !== skipped.lineId)
    .concat([skipped])
  broadenSelectionAfterCompletion()
  startNextLine(t)
}

const restartLine = () => {
  if (!topic.value || !currentLine.value) return
  showActionSheet.value = false
  startLine(topic.value, currentLine.value)
}

const goToParent = () => {
  const t = topic.value
  const parent = parentLine.value
  if (!t || !parent) return
  // The parent is by definition mastered; `exclusive: true` tells
  // selectLineForFocus to return it as-is instead of auto-advancing past it.
  setSelection({
    topicId: t.id,
    focus: { kind: 'line', lineId: parent.id, exclusive: true },
  })
  startLine(t, parent)
}

const goToForgottenParent = (): void => {
  goToParent()
}

const orderedTopicLines = (t: Topic): Line[] =>
  t.families.flatMap((family) => family.lines)

const goToPreviousLine = (): void => {
  const t = topic.value
  const line = currentLine.value
  if (!t || !line) return
  showActionSheet.value = false
  const lines = orderedTopicLines(t)
  const idx = lines.findIndex((entry) => entry.id === line.id)
  if (idx <= 0) return
  const previous = lines[idx - 1]
  if (!previous) return
  setSelection({
    topicId: t.id,
    focus: { kind: 'line', lineId: previous.id, exclusive: true },
  })
  startLine(t, previous)
}

/**
 * Step the chessboard one ply forward or backward through the CURRENT
 * game's move history (replaying or undoing the SAN that was actually
 * played), bounded by the live position so we never reveal unlearned
 * moves. We animate backward via `undoLastMove` so the pieces visually
 * return to their previous squares – just replaying forward to ply-1
 * would animate the SECOND-TO-LAST move and look like a forward motion.
 */
const goMoveHistory = async (delta: -1 | 1): Promise<void> => {
  const max = maxReplayPly.value
  const current = activeReplayPly.value
  const next = Math.min(Math.max(current + delta, 0), max)
  if (next === current) return

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

const showHelp = (): void => {
  const san = session.value?.state.value.expectedSan ?? null
  const ok = showHintForExpected(formatBannerForSan('Hilfe – nächster Zug', san))
  if (!ok) return
  const t = topic.value
  const line = currentLine.value
  if (!t || !line) return
  void $repositories.activity.append({
    topicId: t.id,
    lineId: line.id,
    type: 'help_requested',
    at: Date.now(),
  })
}

const goToOpenings = (): void => {
  void router.push('/openings')
}

declare global {
  interface Window {
    __chessTheory?: {
      submit(san: string): Promise<{ result: string; expected?: string }>
      state(): unknown
      currentLine(): { id: string; fullName: string } | null
      mastered(): string[]
      reset(): Promise<void>
      hint(): {
        active: boolean
        banner: string | null
        bannerKind: BannerKind | null
        demonstratedSteps: number[]
      }
      requestHelp(): boolean
    }
  }
}

const e2eEnabled = computed(() =>
  typeof window !== 'undefined'
  && new URL(window.location.href).searchParams.get('e2e') === '1',
)

onMounted(() => {
  if (typeof window === 'undefined' || !e2eEnabled.value) return
  const applyResetBannerForBridge = (reason: ResetReason): void => {
    const after = markers()
    if (!after) return
    const next = bannerForResetReason(reason, after)
    setBanner(next.kind, next.text)
  }

  window.__chessTheory = {
    submit: async (san) => {
      const s = session.value
      if (!s) return { result: 'no-session' }
      const before = markers()
      if (!before) return { result: 'no-session' }
      const wasNewStepMove = isNewStepMove(s.state.value)
      const r = await s.submit(san)
      if (r.result === 'wrong') {
        showMistakeBanner()
        return { result: 'wrong', expected: r.expected }
      }
      board.value?.playOpponentSan(san)
      clearHintArrow()
      clearEphemeralBanner()
      if (wasNewStepMove) demonstratedSteps.value.add(before.currentStep)

      const afterUser = markers()!

      if (afterUser.phase === 'done') {
        finalizeMastery()
        broadenSelectionAfterCompletion()
        return { result: 'correct' }
      }

      const reasonAfterUser = getResetReason(before, afterUser)
      if (reasonAfterUser !== null) {
        clearHintArrow()
        board.value?.reset()
        await nextTick()
        await replayPrefixOntoBoard()
        applyResetBannerForBridge(reasonAfterUser)
      } else if (
        currentLine.value
        && isOpponentTurn(currentLine.value, s.state.value.expectedMoveIndex)
      ) {
        const opponentSan = currentLine.value.sanMoves[s.state.value.expectedMoveIndex]
        if (opponentSan) {
          board.value?.playOpponentSan(opponentSan)
          await s.submit(opponentSan)
          const afterOpponent = markers()!
          if (afterOpponent.phase === 'done') {
            finalizeMastery()
            broadenSelectionAfterCompletion()
            return { result: 'correct' }
          }
          const reasonAfterOpponent = getResetReason(before, afterOpponent)
          if (reasonAfterOpponent !== null) {
            clearHintArrow()
            board.value?.reset()
            await nextTick()
            await replayPrefixOntoBoard()
            applyResetBannerForBridge(reasonAfterOpponent)
          }
        }
      }

      showHintIfNewStep()
      return { result: 'correct' }
    },
    state: () => session.value?.state.value ?? null,
    currentLine: () =>
      currentLine.value
        ? { id: currentLine.value.id, fullName: currentLine.value.fullName }
        : null,
    mastered: () => {
      try {
        const raw = window.localStorage.getItem('chess-theory:v1:progress')
        if (!raw) return []
        const shape = JSON.parse(raw) as {
          byTopic?: Record<string, Record<string, { status?: string }>>
        }
        const out: string[] = []
        for (const topicEntries of Object.values(shape.byTopic ?? {})) {
          for (const [lineId, entry] of Object.entries(topicEntries)) {
            if (entry?.status === 'mastered') out.push(lineId)
          }
        }
        return out
      } catch {
        return []
      }
    },
    reset: async () => {
      window.localStorage.removeItem('chess-theory:v1:progress')
      if (topic.value) startNextLine(topic.value)
    },
    hint: () => ({
      active: hintActive.value,
      banner: banner.value?.text ?? null,
      bannerKind: banner.value?.kind ?? null,
      demonstratedSteps: Array.from(demonstratedSteps.value),
    }),
    requestHelp: () => {
      const san = session.value?.state.value.expectedSan ?? null
      return showHintForExpected(formatBannerForSan('Hilfe – nächster Zug', san))
    },
  }
})

onBeforeUnmount(() => {
  cancelMistakeTimer()
  if (typeof window !== 'undefined') delete window.__chessTheory
})
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4 sm:py-6">
    <div v-if="!selection" class="rounded-xl border border-(--ui-border) p-6 text-center">
      <UIcon name="i-lucide-graduation-cap" class="mx-auto h-8 w-8 text-(--ui-text-muted)" />
      <h1 class="mt-3 text-xl font-semibold">Noch keine Zugfolge ausgewählt</h1>
      <p class="mx-auto mt-2 max-w-md text-sm text-(--ui-text-muted)">
        Wähle in den Eröffnungen eine Gruppe, eine Eröffnung oder eine
        konkrete Zugfolge. Sie erscheint dann hier zum Üben.
      </p>
      <UButton class="mt-4" color="primary" icon="i-lucide-book-open" @click="goToOpenings">
        Eröffnungen öffnen
      </UButton>
    </div>

    <template v-else>
      <div v-if="loading && !topic" class="text-(--ui-text-muted)">Lade Thema…</div>
      <UAlert
        v-else-if="error"
        color="error"
        variant="soft"
        icon="i-lucide-alert-triangle"
        :title="error.message"
      />

      <template v-else-if="topic">
        <div v-if="allMastered">
          <UAlert
            color="success"
            variant="soft"
            icon="i-lucide-trophy"
            title="Alles gemeistert"
            description="Du hast alle Zugfolgen dieser Auswahl durchgespielt. Wähle eine neue in den Eröffnungen oder in deinem Profil."
          />
        </div>

        <div
          v-else-if="session && currentLine"
          class="learn-layout"
        >
          <div class="min-w-0 px-1 pb-32 pt-2 sm:px-2 sm:pb-4 sm:pt-3">
            <p class="text-xs uppercase tracking-widest text-(--ui-text-muted)">
              {{ topic.label }}
              <template v-if="focusedFamilyName">
                · {{ focusedFamilyName }}
              </template>
            </p>
            <h1
              class="mt-1 text-base leading-tight font-semibold sm:text-2xl"
              data-testid="learn-line-heading"
            >
              {{ currentLine.fullName }}
            </h1>

            <div class="mt-3 min-h-[2.5rem]">
              <Transition
                enter-active-class="transition duration-150"
                leave-active-class="transition duration-150"
                enter-from-class="-translate-y-1 opacity-0"
                leave-to-class="-translate-y-1 opacity-0"
              >
                <div
                  v-if="banner && bannerPreset"
                  :class="[
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                    bannerPreset.classes,
                  ]"
                  role="status"
                  aria-live="polite"
                  :data-banner-kind="banner.kind"
                >
                  <UIcon :name="bannerPreset.icon" class="h-4 w-4 shrink-0" />
                  <span class="min-w-0 flex-1">{{ banner.text }}</span>
                  <UButton
                    v-if="session.state.value.phase === 'intro' && parentLine"
                    color="info"
                    variant="link"
                    size="xs"
                    class="h-auto p-0 text-xs whitespace-nowrap"
                    @click="goToForgottenParent"
                  >
                    Hab ich vergessen
                  </UButton>
                </div>
              </Transition>
            </div>

            <div class="rounded-2xl border border-(--ui-border)/60 bg-(--ui-bg-elevated)/20 p-2 sm:p-3">
              <ChessBoard
                ref="board"
                :orientation="currentLine.userSide"
                :player-color="currentLine.userSide"
                @user-move="handleUserMove"
              />
            </div>
          </div>

          <div
            class="fixed inset-x-0 bottom-[4.25rem] z-[70] px-3 sm:static sm:z-auto sm:px-2"
            style="padding-bottom: env(safe-area-inset-bottom)"
          >
            <div class="relative mx-auto flex w-full max-w-xl items-center justify-center gap-2 rounded-full border border-(--ui-border) bg-(--ui-bg)/95 px-3 py-2 backdrop-blur">
              <UButton
                color="primary"
                variant="soft"
                icon="i-lucide-lightbulb"
                :disabled="hintActive"
                aria-label="Hilfe"
                @click="showHelp"
              />
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-chevron-left"
                :disabled="!canGoBackward"
                aria-label="Zurück"
                @click="goMoveHistory(-1)"
              />
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-chevron-right"
                :disabled="!canGoForward"
                aria-label="Vor"
                @click="goMoveHistory(1)"
              />
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-info"
                aria-label="Info"
                @click="showInfoModal = true"
              />
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-ellipsis"
                aria-label="Mehr"
                @click="showActionSheet = true"
              />
            </div>
          </div>
        </div>

        <UModal v-model:open="showInfoModal">
          <template #content>
            <div class="p-4 sm:p-5">
              <h2 class="mb-3 text-lg font-semibold">{{ currentLine.fullName }}</h2>
              <SessionHud
                :line="currentLine"
                :state="session.state.value"
                :last-feedback="session.lastFeedback.value"
              />
            </div>
          </template>
        </UModal>

        <UModal v-model:open="showActionSheet">
          <template #content>
            <div class="p-3">
              <h2 class="mb-2 text-sm font-semibold text-(--ui-text-muted)">Aktionen</h2>
              <div class="space-y-1">
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-rotate-ccw"
                  class="w-full justify-start"
                  @click="restartLine"
                >
                  Neu starten
                </UButton>
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-skip-forward"
                  class="w-full justify-start"
                  @click="skipLine"
                >
                  Überspringen
                </UButton>
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-corner-up-left"
                  :disabled="!topic || !currentLine"
                  :data-testid="`parent-line-button`"
                  class="w-full justify-start"
                  @click="goToPreviousLine"
                >
                  Vorherige Folge
                </UButton>
              </div>
            </div>
          </template>
        </UModal>
      </template>
    </template>
  </div>
</template>

<style scoped>
.learn-layout {
  min-height: calc(100dvh - 7.5rem);
  overflow: hidden;
}

@media (min-width: 640px) {
  .learn-layout {
    min-height: 0;
    overflow: visible;
  }
}
</style>
