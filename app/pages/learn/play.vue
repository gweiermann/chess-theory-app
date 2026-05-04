<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTopic } from '~/composables/useTopic'
import { useTopicProgress } from '~/composables/useTopicProgress'
import { useCurrentSelection } from '~/composables/useCurrentSelection'
import { useLearnState } from '~/composables/useLearnState'
import { useSessionFlow } from '~/composables/useSessionFlow'
import { useReplayControls } from '~/composables/useReplayControls'
import { useScopedProgress } from '~/composables/useScopedProgress'
import { usePlayHeadings } from '~/composables/usePlayHeadings'
import { useLineLifecycle } from '~/composables/useLineLifecycle'
import { useProfileSettings } from '~/composables/useProfileSettings'
import {
  getResetReason,
  isNewStepMove,
  type PhaseMarkers,
} from '~/domain/session'
import type ChessBoardComponent from '~/components/ChessBoard.vue'
import PlayEmptyState from '~/components/play/PlayEmptyState.vue'
import PlayTopBar from '~/components/play/PlayTopBar.vue'
import PlayActionBar from '~/components/play/PlayActionBar.vue'
import PlayActionSheet from '~/components/play/PlayActionSheet.vue'
import PlayBoardPanel from '~/components/play/PlayBoardPanel.vue'
import PlayHelpModal from '~/components/play/PlayHelpModal.vue'
import PlayCompleteModal from '~/components/play/PlayCompleteModal.vue'
import BaseErrorAlert from '~/components/base/BaseErrorAlert.vue'
import BaseLoadingState from '~/components/base/BaseLoadingState.vue'

definePageMeta({ layout: 'play' })

const STEP_RESET_DELAY_MS = 600
const NEXT_LINE_DELAY_MS = 1500

const router = useRouter()
const goBack = () => router.back()
const { $repositories } = useNuxtApp()
const { selection, set: setSelection, refresh: refreshSelection } = useCurrentSelection()
/** Re-read persisted selection so /learn/play matches storage (singleton composable can be stale across navigations). */
refreshSelection()
const { currentLine, session, demonstratedSteps, allMastered } = useLearnState()
const { autoPlayParentPrefix } = useProfileSettings()

const topicIdRef = computed(() => selection.value?.topicId ?? null)
const { topic, loading, error } = useTopic(topicIdRef)

const board = ref<InstanceType<typeof ChessBoardComponent> | null>(null)
const progressApi = shallowRef<ReturnType<typeof useTopicProgress> | null>(null)
const showInfoModal = ref(false)
const showActionSheet = ref(false)
const flowLocked = ref(false)

const replay = useReplayControls({
  session,
  currentLine,
  board,
  flowLocked,
})

const flow = useSessionFlow({
  session,
  currentLine,
  demonstratedSteps,
  board,
  flowLocked,
  isReplayMode: replay.isReplayMode,
  resetReplayView: replay.resetView,
})

const { masteredCount, totalLineCount } = useScopedProgress({
  topic,
  selection,
  currentLine,
  progressApi,
})

const { focusedFamilyName, phaseLabel, displayLineName } = usePlayHeadings({
  topic,
  selection,
  currentLine,
  session,
})

const lifecycle = useLineLifecycle({
  topic,
  selection,
  currentLine,
  session,
  demonstratedSteps,
  allMastered,
  progressApi,
  board,
  flow,
  replay,
  setSelection,
  closeOverlays: () => {
    showActionSheet.value = false
    showInfoModal.value = false
  },
  $repositories,
  autoPlayParentPrefix,
})

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

const onBoardReady = (instance: InstanceType<typeof ChessBoardComponent> | null): void => {
  board.value = instance
}

const {
  startNextLine,
  restartLine,
  skipLine,
  goToPreviousLine,
  finalizeMastery,
  broadenSelectionAfterCompletion,
  selectionPointsAt,
} = lifecycle

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
      await flow.rehydrateBoardFromSession()
      return
    }
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

const handleUserMove = async (san: string): Promise<void> => {
  if (replay.isReplayMode.value) return
  if (flow.isOpponentInFlight()) {
    // The user pre-moved while the opponent was moving. Buffer it through
    // our submit pipeline instead of letting it race the opponent's submit.
    flow.bufferUserMove(san)
    return
  }
  await processUserMove(san)
}

const processUserMove = async (san: string): Promise<void> => {
  if (flow.isResetting.value) return
  const s = session.value
  const line = currentLine.value
  if (!s || !line) return

  const before = markers()
  if (!before) return
  const wasNewStepMove = isNewStepMove(s.state.value)
  const result = await s.submit(san)

  if (result.result === 'wrong') {
    flow.setBoardLocked(true)
    setTimeout(() => {
      board.value?.undoLastMove()
      flow.setBoardLocked(false)
    }, 200)
    return
  }

  flow.clearHintArrow()
  if (wasNewStepMove) demonstratedSteps.value.add(before.currentStep)

  const afterUser = markers()!

  if (afterUser.phase === 'done') {
    finalizeMastery()
    broadenSelectionAfterCompletion()
    flow.setBoardLocked(true)
    setTimeout(() => topic.value && startNextLine(topic.value), NEXT_LINE_DELAY_MS)
    return
  }

  const reasonAfterUser = getResetReason(before, afterUser)
  if (reasonAfterUser !== null) {
    flow.setBoardLocked(true)
    setTimeout(() => flow.resetBoardForNextAttempt(), STEP_RESET_DELAY_MS)
    return
  }

  await flow.playOpponentIfNeeded()

  // Flush a premove that landed during the opponent turn: useSessionFlow
  // exits early when one is queued so we can run it through processUserMove
  // here (nesting recursion through this same function).
  const queued = flow.flushBufferedUserMove()
  if (queued !== null && !replay.isReplayMode.value) {
    await processUserMove(queued)
    return
  }

  const afterOpponent = markers()!
  if (afterOpponent.phase === 'done') {
    finalizeMastery()
    broadenSelectionAfterCompletion()
    flow.setBoardLocked(true)
    setTimeout(() => topic.value && startNextLine(topic.value), NEXT_LINE_DELAY_MS)
    return
  }

  const reasonAfterOpponent = getResetReason(before, afterOpponent)
  if (reasonAfterOpponent !== null) {
    flow.setBoardLocked(true)
    setTimeout(() => flow.resetBoardForNextAttempt(), STEP_RESET_DELAY_MS)
    return
  }

  flow.showHintIfNewStep()
}

const showHelp = (): void => {
  const ok = flow.showHintForExpected()
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
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <PlayEmptyState v-if="!selection" @go-to-openings="goToOpenings" />

    <template v-else>
      <div v-if="loading && !topic" class="flex flex-1 items-center justify-center p-6">
        <BaseLoadingState message="Lade Thema…" />
      </div>
      <BaseErrorAlert v-else-if="error" :message="error.message" class="m-4" />

      <template v-else-if="topic">
        <PlayCompleteModal v-if="allMastered" />

        <div v-else-if="session && currentLine" class="learn-layout">
          <PlayTopBar
            :topic-label="topic.label"
            :family-name="focusedFamilyName"
            :mastered-count="masteredCount"
            :total-line-count="totalLineCount"
            :line-heading="displayLineName"
            :line-id="currentLine.id"
            @back="goBack"
          />

          <div
            class="shrink-0 relative h-16 w-full overflow-hidden"
            style="max-width: 560px; margin-inline: auto;"
            data-testid="play-phase-bar"
          >
            <div class="absolute inset-0 flex items-center px-4">
              <span
                class="flex-1 truncate text-sm font-medium text-(--ui-primary)"
                data-testid="play-phase-label"
              >
                {{ phaseLabel }}
              </span>
            </div>
          </div>

          <PlayBoardPanel
            :orientation="currentLine.userSide"
            :player-color="currentLine.userSide"
            @user-move="handleUserMove"
            @board-ready="onBoardReady"
          />

          <PlayActionBar
            :hint-active="flow.hintActive.value"
            :can-go-backward="replay.canGoBackward.value"
            :can-go-forward="replay.canGoForward.value"
            @help="showHelp"
            @restart="restartLine"
            @more="showActionSheet = true"
            @step="replay.goMoveHistory"
          />
        </div>

        <PlayHelpModal
          v-if="session && currentLine"
          :open="showInfoModal"
          :line="currentLine"
          :state="session.state.value"
          :last-feedback="session.lastFeedback.value"
          @update:open="showInfoModal = $event"
        />

        <PlayActionSheet
          v-if="session && currentLine"
          :open="showActionSheet"
          :can-go-to-previous="!!topic && !!currentLine"
          @update:open="showActionSheet = $event"
          @restart="restartLine"
          @skip="skipLine"
          @previous="goToPreviousLine"
        />
      </template>
    </template>
  </div>
</template>

<style scoped>
.learn-layout {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
</style>
