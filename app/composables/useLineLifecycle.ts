import type { Ref } from 'vue'
import type { CurrentSelection } from '~/infra/selection-repository'
import type { TrainingSession } from '~/composables/training-session'
import { createTrainingSession } from '~/composables/training-session'
import type { useTopicProgress } from '~/composables/useTopicProgress'
import type ChessBoardComponent from '~/components/ChessBoard.vue'
import type { UseSessionFlow } from '~/composables/useSessionFlow'
import type { UseReplayControls } from '~/composables/useReplayControls'
import { computeLineSetup } from '~/domain/line-setup'
import { selectLineForFocus } from '~/domain/select-next-line'
import { TARGET_REPS } from '~/domain/session'
import type { Line, LineProgress, Topic } from '~/domain/types'

interface UseLineLifecycleArgs {
  topic: Ref<Topic | null>
  selection: Ref<CurrentSelection | null>
  currentLine: Ref<Line | null>
  session: Ref<TrainingSession | null>
  demonstratedSteps: Ref<Set<number>>
  allMastered: Ref<boolean>
  progressApi: Ref<ReturnType<typeof useTopicProgress> | null>
  board: Ref<InstanceType<typeof ChessBoardComponent> | null>
  flow: UseSessionFlow
  replay: UseReplayControls
  setSelection: (sel: CurrentSelection) => void
  // The page owns a couple of UI flags that should reset when a line changes.
  closeOverlays: () => void
  $repositories: {
    createProgressRepository: (t: Topic) => { saveLine: (p: LineProgress) => Promise<void> }
    activity: { append: (event: unknown) => Promise<void> }
  }
  autoPlayParentPrefix: Ref<boolean>
}

export interface UseLineLifecycle {
  startLine: (t: Topic, line: Line) => void
  startNextLine: (t: Topic) => void
  restartLine: () => void
  skipLine: () => void
  goToPreviousLine: () => void
  finalizeMastery: () => void
  broadenSelectionAfterCompletion: () => void
  selectionPointsAt: (line: Line) => boolean
}

const orderedTopicLines = (t: Topic): Line[] =>
  t.families.flatMap((family) => family.lines)

export const useLineLifecycle = ({
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
  closeOverlays,
  $repositories,
  autoPlayParentPrefix,
}: UseLineLifecycleArgs): UseLineLifecycle => {
  const startLine = (t: Topic, line: Line): void => {
    closeOverlays()
    replay.resetView()
    flow.flushBufferedUserMove()
    currentLine.value = line

    const { prefixPlies, skipIntro } = computeLineSetup({
      topic: t,
      line,
      progress: progressApi.value?.progress.value ?? [],
      focus: selection.value?.focus,
      autoPlayParentPrefix: autoPlayParentPrefix.value,
    })

    const repo = $repositories.createProgressRepository(t)
    const activityRecorder = {
      topicId: t.id,
      record: (event: Parameters<typeof $repositories.activity.append>[0]) =>
        $repositories.activity.append(event),
    }
    session.value = createTrainingSession({
      line,
      repo: repo as unknown as Parameters<typeof createTrainingSession>[0]['repo'],
      activityRecorder,
      prefixPlies,
      skipIntro,
    })
    demonstratedSteps.value = new Set()
    flow.clearHintArrow()
    flow.setBoardLocked(true)

    setTimeout(async () => {
      board.value?.reset()
      if (skipIntro && prefixPlies > 0) {
        flow.replayPrefixOntoBoard()
      }
      await flow.playOpponentIfNeeded()
      flow.showBuildingUserHint()
      flow.setBoardLocked(false)
    }, 50)
  }

  /**
   * After mastering or skipping the current line, broaden a line-locked
   * selection so the next-line picker isn't pinned to the just-finished line.
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

  const skipLine = (): void => {
    const t = topic.value
    if (!t || !currentLine.value || !progressApi.value) return
    closeOverlays()
    const skipped: LineProgress = {
      lineId: currentLine.value.id,
      status: 'mastered',
      reps: TARGET_REPS,
      lastPracticedAt: Date.now(),
    }
    // Persist before broadening: broadening triggers a watcher that re-reads
    // localStorage; without persistence first, the just-skipped line would
    // re-appear as un-mastered and progression would stall on it.
    const repo = $repositories.createProgressRepository(t)
    void repo.saveLine(skipped)
    progressApi.value.progress.value = progressApi.value.progress.value
      .filter((p) => p.lineId !== skipped.lineId)
      .concat([skipped])
    broadenSelectionAfterCompletion()
    startNextLine(t)
  }

  const restartLine = (): void => {
    const t = topic.value
    if (!t || !currentLine.value) return
    closeOverlays()
    startLine(t, currentLine.value)
  }

  const goToPreviousLine = (): void => {
    const t = topic.value
    const line = currentLine.value
    if (!t || !line) return
    closeOverlays()
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
   * True if `selection` still ultimately resolves to {@link line} — used to
   * decide whether to keep an existing session alive across topic re-mounts.
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

  return {
    startLine,
    startNextLine,
    restartLine,
    skipLine,
    goToPreviousLine,
    finalizeMastery,
    broadenSelectionAfterCompletion,
    selectionPointsAt,
  }
}
