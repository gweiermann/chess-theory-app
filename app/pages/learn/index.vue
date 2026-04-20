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
import type { Line, Topic } from '~/domain/types'
import type ChessBoardComponent from '~/components/ChessBoard.vue'

const OPPONENT_DELAY_MS = 350
const STEP_RESET_DELAY_MS = 600
const NEXT_LINE_DELAY_MS = 1500

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
const hintBanner = ref<string | null>(null)

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

const clearHint = (): void => {
  if (!hintActive.value && hintBanner.value === null) return
  board.value?.clearHints()
  hintActive.value = false
  hintBanner.value = null
}

const showHintForExpected = (banner: string | null = null): boolean => {
  const s = session.value
  if (!s) return false
  const san = s.state.value.expectedSan
  if (!san) return false
  const ok = board.value?.drawHintForSan(san) ?? false
  if (ok) {
    hintActive.value = true
    hintBanner.value = banner
  }
  return ok
}

const showHintIfNewStep = (): void => {
  const s = session.value
  if (!s) return
  if (!isNewStepMove(s.state.value)) return
  if (demonstratedSteps.value.has(s.state.value.currentStep)) return
  showHintForExpected('Neuer Zug – probiere ihn aus')
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
  showHintIfNewStep()
}

const resetBoardForNextAttempt = async (): Promise<void> => {
  isResetting.value = true
  clearHint()
  board.value?.reset()
  await nextTick()
  isResetting.value = false
  await playOpponentIfNeeded()
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

const handleUserMove = async (san: string): Promise<void> => {
  if (isResetting.value) return
  const s = session.value
  const line = currentLine.value
  if (!s || !line) return

  const beforePhase = s.state.value.phase
  const beforeStep = s.state.value.currentStep
  const wasNewStepMove = isNewStepMove(s.state.value)
  const result = await s.submit(san)

  if (result.result === 'wrong') {
    setTimeout(() => board.value?.undoLastMove(), 200)
    return
  }

  clearHint()
  if (wasNewStepMove) demonstratedSteps.value.add(beforeStep)

  const next = s.state.value
  if (next.phase === 'done') {
    if (currentLine.value && progressApi.value) {
      progressApi.value.progress.value = progressApi.value.progress.value
        .filter((p) => p.lineId !== currentLine.value!.id)
        .concat([{
          lineId: currentLine.value.id,
          status: 'mastered',
          reps: 10,
          lastPracticedAt: Date.now(),
        }])
    }
    setTimeout(() => topic.value && startNextLine(topic.value), NEXT_LINE_DELAY_MS)
    return
  }

  const stepAdvanced =
    beforePhase === 'building' &&
    next.phase === 'building' &&
    next.currentStep > beforeStep
  const enteredRepeating = beforePhase === 'building' && next.phase === 'repeating'
  const repAdvanced =
    beforePhase === 'repeating' &&
    next.phase === 'repeating' &&
    next.expectedMoveIndex === 0

  if (stepAdvanced || repAdvanced || enteredRepeating) {
    setTimeout(resetBoardForNextAttempt, STEP_RESET_DELAY_MS)
    return
  }

  await playOpponentIfNeeded()
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
  const ok = showHintForExpected('Hilfe – nächster Zug')
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
      hint(): { active: boolean; banner: string | null; demonstratedSteps: number[] }
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
  window.__chessTheory = {
    submit: async (san) => {
      const s = session.value
      if (!s) return { result: 'no-session' }
      const beforePhase = s.state.value.phase
      const beforeStep = s.state.value.currentStep
      const wasNewStepMove = isNewStepMove(s.state.value)
      const r = await s.submit(san)
      if (r.result === 'wrong') {
        return { result: 'wrong', expected: r.expected }
      }
      // Mirror the move on the real board so its position stays consistent
      // with the session – the help button reads from the board's FEN.
      board.value?.playOpponentSan(san)
      clearHint()
      if (wasNewStepMove) demonstratedSteps.value.add(beforeStep)

      const next = s.state.value
      const stepAdvanced =
        beforePhase === 'building'
        && next.phase === 'building'
        && next.currentStep > beforeStep
      const enteredRepeating = beforePhase === 'building' && next.phase === 'repeating'
      const repAdvanced =
        beforePhase === 'repeating'
        && next.phase === 'repeating'
        && next.expectedMoveIndex === 0

      if (stepAdvanced || repAdvanced || enteredRepeating) {
        board.value?.reset()
        await nextTick()
      }

      if (
        next.phase !== 'done'
        && currentLine.value
        && isOpponentTurn(currentLine.value, s.state.value.expectedMoveIndex)
      ) {
        const opponentSan = currentLine.value.sanMoves[s.state.value.expectedMoveIndex]
        if (opponentSan) {
          board.value?.playOpponentSan(opponentSan)
          await s.submit(opponentSan)
        }
      }
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
      banner: hintBanner.value,
      demonstratedSteps: Array.from(demonstratedSteps.value),
    }),
    requestHelp: () => showHintForExpected('Hilfe – nächster Zug'),
  }
})

onBeforeUnmount(() => {
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
            <Transition
              enter-active-class="transition duration-150"
              leave-active-class="transition duration-150"
              enter-from-class="-translate-y-1 opacity-0"
              leave-to-class="-translate-y-1 opacity-0"
            >
              <div
                v-if="hintBanner"
                class="flex items-center gap-2 rounded-lg border border-(--ui-primary)/30 bg-(--ui-primary)/10 px-3 py-2 text-sm text-(--ui-primary)"
              >
                <UIcon name="i-lucide-lightbulb" class="h-4 w-4" />
                <span>{{ hintBanner }}</span>
              </div>
            </Transition>

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
