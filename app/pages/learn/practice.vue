<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMasteredPool } from '~/composables/useMasteredPool'
import { useRandomPractice } from '~/composables/useRandomPractice'
import PlayPhaseBar from '~/components/play/PlayPhaseBar.vue'
import PlayBoardPanel from '~/components/play/PlayBoardPanel.vue'
import PlayContinueBar from '~/components/play/PlayContinueBar.vue'
import FeedbackBanner from '~/components/play/FeedbackBanner.vue'
import DevPlayCommandInput from '~/components/play/DevPlayCommandInput.vue'
import BaseErrorAlert from '~/components/base/BaseErrorAlert.vue'
import BaseLoadingState from '~/components/base/BaseLoadingState.vue'

definePageMeta({ layout: 'play' })

const router = useRouter()
const goBack = () => void router.push('/learn')
const goToOverview = () => void router.push('/learn')

const { lines, loading, error, load } = useMasteredPool()
const {
  session,
  feedback,
  hintSans,
  isComputerMoving,
  startSession,
  registerBoard,
  handleUserMove,
  requestHelp,
  continueToNextRound,
  rehydrateBoard,
} = useRandomPractice()
const devPlayBridgeEnabled = import.meta.dev || import.meta.env.VITE_E2E === '1'

// The board is square and sized by width. Cap it to the available height so
// the whole practice UI stays on one mobile screen (no vertical scroll).
let resizeObserver: ResizeObserver | null = null
const boardAreaRef = ref<HTMLElement | null>(null)
const boardSizePx = ref(0)

const measureBoard = (): void => {
  const el = boardAreaRef.value
  if (!el) return
  const side = Math.max(0, Math.floor(Math.min(el.clientWidth, el.clientHeight)))
  if (side !== boardSizePx.value) boardSizePx.value = side
}

const startObservingBoard = (): void => {
  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(measureBoard)
  if (boardAreaRef.value) {
    resizeObserver.observe(boardAreaRef.value)
    measureBoard()
  }
}

// The board region only renders once a session exists (after the async pool
// load). Start observing once it is attached; the observer keeps tracking
// height changes (e.g. the continue bar replacing the action row).
watch(boardAreaRef, startObservingBoard, { flush: 'post' })
onBeforeUnmount(() => resizeObserver?.disconnect())

const hasMastered = computed(() => (lines.value?.length ?? 0) > 0)
const userSide = computed(() => session.value?.userSide ?? 'white')
const isRoundComplete = computed(() => session.value?.phase === 'round-complete')
const showContinueBar = computed(() => isRoundComplete.value && Boolean(session.value?.lastRound))

const continuations = computed(() =>
  session.value?.phase === 'user' ? [...session.value.node.edges.keys()] : [],
)

const phaseLabel = computed(() => {
  const s = session.value
  if (!s) return ''
  if (s.phase === 'round-complete') return 'Runde abgeschlossen'
  return s.phase === 'user' ? 'Dein Zug' : 'Gegner zieht'
})

const devCaption = computed(() => {
  const s = session.value
  if (!s) return ''
  if (s.phase === 'computer') return 'Gegner zieht'
  if (s.phase === 'round-complete') return 'Runde abgeschlossen'
  return continuations.value.length > 0 ? 'Dein Zug (gelernt)' : 'Keine gelernte Fortsetzung'
})

const devSan = computed(() =>
  session.value?.phase === 'user' ? continuations.value.join(', ') : null,
)

const hintDisabled = computed(
  () => !session.value || session.value.phase !== 'user' || continuations.value.length === 0,
)

onMounted(async () => {
  if (session.value) {
    await rehydrateBoard()
    return
  }
  try {
    const mastered = await load()
    if (mastered.length > 0) startSession(mastered)
  } catch {
    // surfaced via `error` ref
  }
})
</script>

<template>
  <div class="flex h-dvh flex-col">
    <div
      class="shrink-0 border-b border-(--ui-border)/50 bg-(--ui-bg)"
      data-testid="practice-top-bar"
    >
      <div class="flex items-center gap-2 px-2 py-2">
        <button
          class="shrink-0 -ml-1 rounded-lg p-1 text-(--ui-text-muted) transition-colors hover:text-(--ui-text)"
          aria-label="Verlassen"
          data-testid="practice-back-button"
          @click="goBack"
        >
          <UIcon name="i-lucide-chevron-left" class="h-7 w-7" />
        </button>
        <p class="flex-1 truncate text-center text-xl text-(--ui-text-muted)">
          Zufallsmodus
        </p>
        <span class="min-w-12 shrink-0 text-right text-lg tabular-nums text-(--ui-text)">
          <span data-testid="practice-score">{{ session?.score ?? 0 }}</span>
          <span class="text-sm text-(--ui-text-muted)"> P</span>
        </span>
      </div>
      <p class="pb-2 text-center text-sm text-(--ui-text-muted)">
        Serie:
        <span class="font-medium tabular-nums" data-testid="practice-streak">
          {{ session?.streak ?? 0 }}
        </span>
      </p>
      <p
        v-if="session?.targetName"
        class="border-t border-(--ui-border)/40 bg-(--ui-primary)/8 py-1.5 text-center text-sm font-medium text-(--ui-primary)"
        data-testid="practice-target-line"
      >
        Ziel: {{ session.targetName }}
      </p>
    </div>

    <div v-if="loading && !lines" class="flex flex-1 items-center justify-center p-6">
      <BaseLoadingState message="Lade gelernte Eröffnungen…" />
    </div>
    <BaseErrorAlert v-else-if="error" :message="error.message" class="m-4" />

    <div v-else-if="!hasMastered" class="flex flex-1 items-center justify-center p-6">
      <div class="rounded-xl border border-(--ui-border) p-6 text-center">
        <UIcon name="i-lucide-shuffle" class="mx-auto h-8 w-8 text-(--ui-text-muted)" />
        <h1 class="mt-3 text-xl font-semibold">Noch keine gelernten Eröffnungen</h1>
        <p class="mx-auto mt-2 max-w-md text-sm text-(--ui-text-muted)">
          Der Zufallsmodus fragt Züge aus Eröffnungen ab, die du bereits
          gemeistert hast. Lerne zuerst ein paar Zugfolgen in den Eröffnungen,
          dann kommen sie hier dran.
        </p>
        <UButton
          class="mt-4"
          color="primary"
          icon="i-lucide-book-open"
          data-testid="practice-go-openings"
          @click="goToOverview"
        >
          Zur Übersicht
        </UButton>
      </div>
    </div>

    <template v-else-if="session">
      <PlayPhaseBar :label="phaseLabel" />

      <div ref="boardAreaRef" class="board-fit relative flex min-h-0 flex-1 items-center justify-center">
        <div class="shrink-0" :style="{ width: `${boardSizePx}px` }">
          <PlayBoardPanel
            :orientation="userSide"
            :player-color="userSide"
            @user-move="handleUserMove"
            @board-ready="registerBoard"
          />
        </div>
      </div>

      <div class="shrink-0 px-4 py-2 text-center">
        <FeedbackBanner :feedback="feedback" />
        <p
          v-if="hintSans && feedback?.kind !== 'wrong'"
          class="mt-1 text-sm text-(--ui-primary)"
          data-testid="practice-hint"
        >
          Möglich: <span class="font-mono">{{ hintSans.join(', ') }}</span>
        </p>
      </div>

      <template v-if="showContinueBar && session.lastRound">
        <PlayContinueBar
          :round-number="session.lastRound.roundNumber"
          :points-earned="session.lastRound.pointsEarned"
          :mistakes="session.lastRound.mistakes"
          :help-used="session.lastRound.helpUsed"
          :bonus="session.lastRound.bonus"
          :target-met="session.lastRound.targetMet"
          :total-score="session.score"
          :streak="session.streak"
          @continue="continueToNextRound"
        />
      </template>

      <div
        v-else
        class="shrink-0 border-t border-(--ui-border) bg-(--ui-bg)/95 backdrop-blur"
        style="padding-bottom: env(safe-area-inset-bottom)"
        data-testid="practice-action-bar"
      >
        <div class="mx-auto flex max-w-sm items-center justify-around px-4 py-3">
          <button
            type="button"
            class="flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2.5 text-sm font-medium text-(--ui-primary) transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            :class="hintSans && !hintDisabled ? 'bg-(--ui-primary)/12 ring-1 ring-(--ui-primary)/35' : ''"
            :disabled="hintDisabled"
            aria-label="Hilfe"
            :aria-pressed="hintDisabled ? undefined : Boolean(hintSans)"
            data-testid="practice-help"
            @click="requestHelp"
          >
            <UIcon name="i-lucide-lightbulb" class="h-5 w-5" />
            <span>Hilfe</span>
          </button>
          <span class="text-sm text-(--ui-text-muted)">
            Runde: <span class="tabular-nums" data-testid="practice-round">{{ session.roundNumber }}</span>
          </span>
          <button
            type="button"
            class="flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2.5 text-sm font-medium text-(--ui-text-muted) transition-colors hover:text-(--ui-text)"
            aria-label="Neue Runde"
            data-testid="practice-restart"
            @click="() => continueToNextRound()"
          >
            <UIcon name="i-lucide-rotate-ccw" class="h-5 w-5" />
            <span>Neue Runde</span>
          </button>
        </div>
      </div>

      <DevPlayCommandInput
        v-if="devPlayBridgeEnabled"
        :disabled="isComputerMoving || isRoundComplete"
        :next-move-caption="devCaption"
        :next-move-san="devSan"
        @command="handleUserMove"
      />
    </template>
  </div>
</template>
