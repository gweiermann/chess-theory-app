<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTopic } from '~/composables/useTopic'
import { useTopicProgress } from '~/composables/useTopicProgress'
import { useCurrentSelection } from '~/composables/useCurrentSelection'
import {
  createTrainingSession,
  type TrainingSession,
} from '~/composables/training-session'
import { selectLineForFocus } from '~/domain/select-next-line'
import { isNewStepMove } from '~/domain/session'
import {
  MISTAKE_BANNER_TEXT,
  bannerForResetReason,
  getResetReason,
  type Banner,
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
const { selection } = useCurrentSelection()

const topicIdRef = computed(() => selection.value?.topicId ?? null)
const { topic, loading, error } = useTopic(topicIdRef)

const session = shallowRef<TrainingSession | null>(null)
const currentLine = ref<Line | null>(null)
const board = ref<InstanceType<typeof ChessBoardComponent> | null>(null)
const progressApi = shallowRef<ReturnType<typeof useTopicProgress> | null>(null)
const allMastered = ref(false)
const isResetting = ref(false)
const demonstratedSteps = ref<Set<number>>(new Set())
const hintActive = ref(false)
const banner = ref<Banner | null>(null)
let mistakeTimer: ReturnType<typeof setTimeout> | null = null

const bannerPreset = computed(() =>
  banner.value ? BANNER_PRESETS[banner.value.kind] : null,
)

const focusedFamilyName = computed(() => {
  const sel = selection.value
  const t = topic.value
  if (!sel || !t) return null
  const focus = sel.focus
  if (focus.kind !== 'family') return null
  return t.families.find((f) => f.id === focus.familyId)?.name ?? null
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
  if (state.phase !== 'building' && state.phase !== 'repeating') return
  if (!isOpponentTurn(line, state.expectedMoveIndex)) return
  const opponentSan = line.sanMoves[state.expectedMoveIndex]
  if (!opponentSan) return

  await new Promise((r) => setTimeout(r, OPPONENT_DELAY_MS))
  const ok = board.value?.playOpponentSan(opponentSan)
  if (!ok) return
  await s.submit(opponentSan)
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
  // The next banner (if any) is computed from the CURRENT session state,
  // not from stale markers captured before the reset.
  const after = markers()
  if (reason !== null && after !== null) {
    const next = bannerForResetReason(reason, after)
    setBanner(next.kind, next.text)
  } else {
    clearBanner()
  }
  board.value?.reset()
  await nextTick()
  isResetting.value = false
  await playOpponentIfNeeded()
  showHintIfNewStep()
}

const startLine = (t: Topic, line: Line): void => {
  currentLine.value = line
  const repo = $repositories.createProgressRepository(t)
  const activityRecorder = {
    topicId: t.id,
    record: (event: Parameters<typeof $repositories.activity.append>[0]) =>
      $repositories.activity.append(event),
  }
  session.value = createTrainingSession({ line, repo, activityRecorder })
  demonstratedSteps.value = new Set()
  clearHint()
  setTimeout(async () => {
    board.value?.reset()
    await nextTick()
    await playOpponentIfNeeded()
    showHintIfNewStep()
  }, 50)
}

const startNextLine = (t: Topic): void => {
  if (!progressApi.value || !selection.value) {
    allMastered.value = false
    currentLine.value = null
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
    session.value = null
    return
  }
  allMastered.value = false
  startLine(t, next)
}

watch(
  topic,
  async (t) => {
    if (!t) {
      progressApi.value = null
      currentLine.value = null
      session.value = null
      return
    }
    progressApi.value = useTopicProgress(t)
    await progressApi.value.refresh()
    startNextLine(t)
  },
  { immediate: true },
)

watch(
  () => selection.value,
  async (sel) => {
    if (!sel || !topic.value || topic.value.id !== sel.topicId) return
    if (!progressApi.value) return
    await progressApi.value.refresh()
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
      reps: 10,
      lastPracticedAt: Date.now(),
    }])
}

const handleUserMove = async (san: string): Promise<void> => {
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
    setTimeout(() => board.value?.undoLastMove(), 200)
    return
  }

  clearHintArrow()
  clearEphemeralBanner()
  if (wasNewStepMove) demonstratedSteps.value.add(before.currentStep)

  // The user move alone may advance the session, OR the transition may only
  // happen once the forced opponent reply (e.g. 1...Nf6 after 1.e4 in the
  // Alekhine Defense) has been played. We therefore check BOTH after the user
  // move and again after the opponent reply before deciding whether to reset
  // the board and re-arm the new-step hint.
  const afterUser = markers()!
  if (afterUser.phase === 'done') {
    finalizeMastery()
    setTimeout(() => topic.value && startNextLine(topic.value), NEXT_LINE_DELAY_MS)
    return
  }

  const reasonAfterUser = getResetReason(before, afterUser)
  if (reasonAfterUser !== null) {
    setTimeout(() => resetBoardForNextAttempt(reasonAfterUser), STEP_RESET_DELAY_MS)
    return
  }

  await playOpponentIfNeeded()

  const afterOpponent = markers()!
  if (afterOpponent.phase === 'done') {
    finalizeMastery()
    setTimeout(() => topic.value && startNextLine(topic.value), NEXT_LINE_DELAY_MS)
    return
  }

  const reasonAfterOpponent = getResetReason(before, afterOpponent)
  if (reasonAfterOpponent !== null) {
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
      reps: 10,
      lastPracticedAt: Date.now(),
    }])
  startNextLine(topic.value)
}

const restartLine = () => {
  if (!topic.value || !currentLine.value) return
  startLine(topic.value, currentLine.value)
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
      // Mirror the move on the real board so its position stays consistent
      // with the session – the help button reads from the board's FEN.
      board.value?.playOpponentSan(san)
      clearHintArrow()
      clearEphemeralBanner()
      if (wasNewStepMove) demonstratedSteps.value.add(before.currentStep)

      const afterUser = markers()!
      if (afterUser.phase === 'done') {
        return { result: 'correct' }
      }

      // The user move alone may not have advanced the phase yet (e.g. after
      // 1.e4 in the Alekhine, the transition only happens once the opponent's
      // forced ...Nf6 reply is applied). Reset first if needed, otherwise play
      // the opponent reply and re-check before re-arming the hint.
      const reasonAfterUser = getResetReason(before, afterUser)
      if (reasonAfterUser !== null) {
        clearHintArrow()
        board.value?.reset()
        await nextTick()
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
  <div class="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
    <div v-if="!selection" class="rounded-xl border border-(--ui-border) p-6 text-center">
      <UIcon name="i-lucide-graduation-cap" class="mx-auto h-8 w-8 text-(--ui-text-muted)" />
      <h1 class="mt-3 text-xl font-semibold">Noch keine Linie ausgewählt</h1>
      <p class="mx-auto mt-2 max-w-md text-sm text-(--ui-text-muted)">
        Wähle in den Eröffnungen ein Thema, eine Familie oder eine konkrete
        Linie. Sie erscheint dann hier zum Üben.
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
        <div class="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <p class="truncate text-xs uppercase tracking-widest text-(--ui-text-muted)">
              {{ topic.label }}
              <template v-if="focusedFamilyName">
                · {{ focusedFamilyName }}
              </template>
            </p>
            <h1 class="text-xl font-semibold sm:text-3xl">Üben</h1>
          </div>
          <div v-if="progressApi" class="w-full sm:w-56">
            <TopicProgress
              :mastered="progressApi.masteredFamilyCount.value"
              :total="progressApi.totalFamilyCount.value"
              size="sm"
              unit-label="Familien"
            />
          </div>
        </div>

        <div v-if="allMastered">
          <UAlert
            color="success"
            variant="soft"
            icon="i-lucide-trophy"
            title="Alles gemeistert"
            description="Du hast alle Linien dieser Auswahl durchgespielt. Wähle eine neue in den Eröffnungen oder der Aktivität."
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
              Before this, showing/hiding the banner changed the board's
              viewport top which left chessground's cached bounding rect
              stale; the user would see clicks land on the wrong square until
              the next window resize. Keeping the slot height stable lets the
              board's hit-testing stay aligned regardless of hint state.
            -->
            <div class="min-h-[2.5rem]">
              <!--
                NO `:key` on the banner div below. Earlier revisions used a
                key bound to `banner.kind` to force a re-animation on kind
                change, but `<Transition>` defaults to simultaneous leave+
                enter, which would put TWO banner divs into layout at once
                for 150ms and shift the board down by one banner-height.
                Updating classes/text in place keeps the slot height stable
                while still animating the initial show/hide.
              -->
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
                variant="soft"
                color="neutral"
                icon="i-lucide-rotate-ccw"
                @click="restartLine"
              >
                Linie neu starten
              </UButton>
              <UButton
                variant="soft"
                color="warning"
                icon="i-lucide-skip-forward"
                @click="skipLine"
              >
                Linie überspringen
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
