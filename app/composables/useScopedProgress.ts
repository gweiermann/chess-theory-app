import { computed, type ComputedRef, type Ref } from 'vue'
import type { CurrentSelection } from '~/infra/selection-repository'
import type { useTopicProgress } from '~/composables/useTopicProgress'
import type { Line, Topic } from '~/domain/types'

interface UseScopedProgressArgs {
  topic: Ref<Topic | null>
  selection: Ref<CurrentSelection | null>
  currentLine: Ref<Line | null>
  progressApi: Ref<ReturnType<typeof useTopicProgress> | null>
}

export interface UseScopedProgress {
  progressScopedLines: ComputedRef<Line[]>
  masteredCount: ComputedRef<number>
  totalLineCount: ComputedRef<number>
}

/**
 * Derive the lines that participate in the current focus's mastery counter,
 * plus the rolled-up mastered/total counts. Scoping to the focused family (or
 * the focused line's family) keeps the progress readout meaningful even when
 * the topic itself contains thousands of lines.
 */
export const useScopedProgress = ({
  topic,
  selection,
  currentLine,
  progressApi,
}: UseScopedProgressArgs): UseScopedProgress => {
  const progressScopedLines = computed<Line[]>(() => {
    const t = topic.value
    const sel = selection.value
    if (!t || !sel) return []
    const focus = sel.focus
    if (focus.kind === 'node') {
      const lineIdSet = new Set(focus.lineIds)
      return t.families.flatMap((f) => f.lines).filter((l) => lineIdSet.has(l.id))
    }
    if (focus.kind === 'line' && focus.exclusive) {
      const line = t.families.flatMap((f) => f.lines).find((l) => l.id === focus.lineId)
      return line ? [line] : []
    }
    let familyId: string | null = null
    if (focus.kind === 'family') familyId = focus.familyId
    else if (focus.kind === 'line') {
      familyId = t.families.find((f) => f.lines.some((l) => l.id === focus.lineId))?.id ?? null
    }
    if (!familyId) {
      const line = currentLine.value
      if (line) familyId = t.families.find((f) => f.lines.some((l) => l.id === line.id))?.id ?? null
    }
    const family = familyId ? t.families.find((f) => f.id === familyId) : null
    return family?.lines ?? t.families.flatMap((f) => f.lines)
  })

  const masteredCount = computed(() => {
    const ids = new Set(progressScopedLines.value.map((l) => l.id))
    return (
      progressApi.value?.progress.value.filter(
        (p) => p.status === 'mastered' && ids.has(p.lineId),
      ).length ?? 0
    )
  })

  const totalLineCount = computed(() => progressScopedLines.value.length)

  return { progressScopedLines, masteredCount, totalLineCount }
}
