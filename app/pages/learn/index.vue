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
import type { Line, Topic } from '~/domain/types'
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

const topicIdRef = computed(() => selection.value?.topicId ?? null)
const { topic, loading, error } = useTopic(topicIdRef)

const {
  currentLine,
  parentLine,
  session,
  demonstratedSteps,
  banner,
  allMastered,
  introCompletedLineIds,
} = learnState

const board = ref<InstanceType<typeof ChessBoardComponent> | null>(null)
const progressApi = shallowRef<ReturnType<typeof useTopicProgress> | null>(null)
const isResetting = ref(false)
const hintActive = ref(false)
let mistakeTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Chessground supports pre-moves out of the box: while it's the opponent's
 * turn the user can click one of their own pieces and chessground queues
 * the move as a "premove" (ghost indicator) which is auto-applied the moment
 * the opponent actually plays. The auto-application fires `user-move` SYNC
 * during the opponent's `api.move()` call – before we've pushed the
 * opponent's move through the training session. If we forwarded that event
 * directly it would race the opponent submit and the session would reject
 * the premove as "wrong" (expected opponent SAN, got user SAN).
 *
 * So we buffer: while {@link opponentInFlight} is true, {@link handleUserMove}
 * stashes the SAN in {@link pendingUserMove} and returns. Once
 * {@link playOpponentIfNeeded} has finished submitting the opponent's move it
 * flushes the buffer through the normal {@link processUserMove} pipeline.
 */
let opponentInFlight = false
let pendingUserMove: string | null = null

const bannerPreset = computed(() =>
  banner.value ? BANNER_PRESETS[banner.value.kind] : null,
)

const currentFamily = computed(() => {
  const t = topic.value
  const line = currentLine.value
  if (!t || !line) return null
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
  board.value?.setLocked(locked)
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

  // Only lock the board during the opponent's ~350ms delay when we KNOW the
  // opponent's move will cause the board to snap back (done, new step,
  // entering repeating, new rep). Otherwise leave movable.color at the
  // user's side so chessground's built-in premovable kicks in and the user
  // can line up their next move while the opponent is still "thinking".
  const willReset = willMoveTriggerReset(state, opponentSan)
  opponentInFlight = true
  pendingUserMove = null
  if (willReset) setBoardLocked(true)

  await new Promise((r) => setTimeout(r, OPPONENT_DELAY_MS))
  const ok = board.value?.playOpponentSan(opponentSan)
  if (!ok) {
    opponentInFlight = false
    pendingUserMove = null
    if (willReset) setBoardLocked(false)
    return
  }
  await s.submit(opponentSan)

  opponentInFlight = false
  if (willReset) setBoardLocked(false)

  // If chessground auto-played a premove during / right after the opponent's
  // move it ended up queued in `pendingUserMove`. Now that the session
  // knows about the opponent's move we can feed the premove through the
  // normal pipeline so it either advances the session or flashes the
  // mistake banner just like a "live" move would.
  const queued = pendingUserMove
  pendingUserMove = null
  if (queued !== null) {
    await processUserMove(queued)
  }
}

/**
 * Auto-play the prefix plies (the parent's moves) onto the board in one go.
 * Used both when the user first arrives at the line AFTER completing the
 * intro, and on every subsequent reset – the user should never have to
 * replay the parent's moves by hand again.
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

const startLine = (t: Topic, line: Line): void => {
  currentLine.value = line
  const progress = progressApi.value?.progress.value ?? []
  const parent = findParentLine(t, line, progress)
  parentLine.value = parent

  const introAlreadyDone = introCompletedLineIds.value.has(line.id)
  const hasRealParent =
    !!parent
    && parent.sanMoves.length > 0
    && parent.sanMoves.length < line.sanMoves.length

  // Treat the topic's own first move (e.g. "1.e4") as an implicit parent:
  // every e4 line shares that opening move, so drilling it on every fresh
  // line would be pointless. We synthesize a prefix of length 1 and skip
  // the intro walkthrough so the move is just auto-played onto the board
  // before the user starts on the actual new material. No real parent line
  // is attached (the "Zurück zu" button requires a real line to navigate
  // back to).
  const hasVirtualFirstMoveParent =
    !hasRealParent
    && line.sanMoves.length > 1
    && line.sanMoves[0] === t.firstMove

  const prefixPlies = hasRealParent
    ? parent!.sanMoves.length
    : hasVirtualFirstMoveParent
      ? 1
      : 0

  // Run the intro walkthrough only for REAL parents on their first visit.
  // The virtual first-move parent never warrants an intro – the user has
  // either just opened the app or already played countless lines starting
  // with this exact move.
  const runsIntro = hasRealParent && !introAlreadyDone
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

  if (runsIntro && parent) {
    setBanner(
      'memory',
      `Spiele die Eröffnung "${parent.fullName}" bis zur Grundposition`,
    )
  }

  setTimeout(async () => {
    board.value?.reset()
    await nextTick()
    if (!runsIntro && prefixPlies > 0) {
      await replayPrefixOntoBoard()
    }
    await playOpponentIfNeeded()
    showHintIfNewStep()
    setBoardLocked(false)
  }, 50)
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

/**
 * Entry point wired to the chessboard's `@user-move` event. Pre-moves that
 * chessground auto-applies while we're still waiting for the opponent to
 * submit get buffered here so they race neither with the opponent's submit
 * nor with each other. Everything else is forwarded straight into
 * {@link processUserMove}.
 */
const handleUserMove = async (san: string): Promise<void> => {
  if (opponentInFlight) {
    // Overwrite any prior premove – chessground only keeps one at a time
    // anyway and the user's most recent click is what they meant.
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
  // When the intro walkthrough just finished, remember it at module level so
  // future visits to this same line skip the recap and go straight into the
  // building phase with the prefix auto-played for us.
  if (before.phase === 'intro' && afterUser.phase === 'building') {
    introCompletedLineIds.value = new Set(introCompletedLineIds.value).add(line.id)
  }

  if (afterUser.phase === 'done') {
    finalizeMastery()
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
  progressApi.value.progress.value = progressApi.value.progress.value
    .filter((p) => p.lineId !== currentLine.value!.id)
    .concat([{
      lineId: currentLine.value.id,
      status: 'mastered',
      reps: TARGET_REPS,
      lastPracticedAt: Date.now(),
    }])
  startNextLine(topic.value)
}

const restartLine = () => {
  if (!topic.value || !currentLine.value) return
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

      const line = currentLine.value
      const afterUser = markers()!
      if (line && before.phase === 'intro' && afterUser.phase === 'building') {
        introCompletedLineIds.value = new Set(introCompletedLineIds.value).add(line.id)
      }

      if (afterUser.phase === 'done') {
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
      introCompletedLineIds.value = new Set()
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
  <div class="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
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
        <!--
          Heading: drops the standalone "Üben" label and merges the current
          line's full name into the h1 so the user always knows WHICH line
          they are drilling. The kicker above keeps the topic + family for
          context on narrow screens where the h1 may truncate.
        -->
        <div class="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <p class="truncate text-xs uppercase tracking-widest text-(--ui-text-muted)">
              {{ topic.label }}
              <template v-if="focusedFamilyName">
                · {{ focusedFamilyName }}
              </template>
            </p>
            <h1 class="truncate text-xl font-semibold sm:text-3xl">
              <template v-if="currentLine">{{ currentLine.fullName }}</template>
              <template v-else-if="allMastered">Alles gemeistert</template>
              <template v-else>Lade…</template>
            </h1>
          </div>
          <div v-if="progressApi" class="w-full sm:w-56">
            <TopicProgress
              :mastered="progressApi.masteredLineCount.value"
              :total="progressApi.totalLineCount.value"
              size="sm"
              unit-label="Zugfolgen"
            />
          </div>
        </div>

        <div v-if="allMastered">
          <UAlert
            color="success"
            variant="soft"
            icon="i-lucide-trophy"
            title="Alles gemeistert"
            description="Du hast alle Zugfolgen dieser Auswahl durchgespielt. Wähle eine neue in den Eröffnungen oder der Aktivität."
          />
        </div>

        <div
          v-else-if="session && currentLine"
          class="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          <div class="space-y-3">
            <!--
              The banner slot reserves its own vertical space (min-height) so
              that toggling the hint NEVER shifts the chessboard below it.
            -->
            <div class="min-h-[2.5rem]">
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
                  <span>{{ banner.text }}</span>
                </div>
              </Transition>
            </div>

            <ChessBoard
              ref="board"
              :orientation="currentLine.userSide"
              :player-color="currentLine.userSide"
              @user-move="handleUserMove"
            />
          </div>

          <div class="space-y-3 sm:space-y-4">
            <SessionHud
              :line="currentLine"
              :state="session.state.value"
              :last-feedback="session.lastFeedback.value"
            />

            <div class="flex flex-wrap gap-2">
              <UButton
                color="primary"
                variant="soft"
                icon="i-lucide-lightbulb"
                :disabled="hintActive"
                @click="showHelp"
              >
                Hilfe
              </UButton>
              <UButton
                v-if="parentLine"
                variant="soft"
                color="info"
                icon="i-lucide-corner-up-left"
                :data-testid="`parent-line-button`"
                @click="goToParent"
              >
                Zurück zu „{{ parentLine.fullName }}"
              </UButton>
              <UButton
                variant="soft"
                color="neutral"
                icon="i-lucide-rotate-ccw"
                @click="restartLine"
              >
                Zugfolge neu starten
              </UButton>
              <UButton
                variant="soft"
                color="warning"
                icon="i-lucide-skip-forward"
                @click="skipLine"
              >
                Zugfolge überspringen
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
