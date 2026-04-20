import { computed, ref, type Ref, type ComputedRef } from 'vue'
import {
  countMasteredFamilies,
  isFamilyMastered,
  topicFamilyMasteryRatio,
} from '~/domain/progress'
import { selectNextLine } from '~/domain/select-next-line'
import type { Family, Line, LineProgress, Topic } from '~/domain/types'

export interface TopicProgressState {
  progress: Ref<LineProgress[]>
  masteredLineCount: ComputedRef<number>
  totalLineCount: ComputedRef<number>
  masteredFamilyCount: ComputedRef<number>
  totalFamilyCount: ComputedRef<number>
  ratio: ComputedRef<number>
  nextLine: ComputedRef<Line | null>
  refresh: () => Promise<void>
  isMastered: (lineId: string) => boolean
  isFamilyMastered: (family: Family) => boolean
}

export const useTopicProgress = (topic: Topic): TopicProgressState => {
  const { $repositories } = useNuxtApp()
  const progress = ref<LineProgress[]>([])

  const refresh = async (): Promise<void> => {
    const repo = $repositories.createProgressRepository(topic)
    progress.value = await repo.listByTopic(topic.id)
  }

  const totalLineCount = computed(() =>
    topic.families.reduce((sum, f) => sum + f.lines.length, 0),
  )
  const masteredLineCount = computed(
    () => progress.value.filter((p) => p.status === 'mastered').length,
  )
  const totalFamilyCount = computed(() => topic.families.length)
  const masteredFamilyCount = computed(() =>
    countMasteredFamilies(topic.families, progress.value),
  )
  const ratio = computed(() =>
    topicFamilyMasteryRatio(topic.families, progress.value),
  )
  const nextLine = computed(() => selectNextLine(topic, progress.value))

  const isMastered = (lineId: string): boolean =>
    progress.value.some((p) => p.lineId === lineId && p.status === 'mastered')

  const familyMasteredHelper = (family: Family): boolean =>
    isFamilyMastered(family, progress.value)

  return {
    progress,
    masteredLineCount,
    totalLineCount,
    masteredFamilyCount,
    totalFamilyCount,
    ratio,
    nextLine,
    refresh,
    isMastered,
    isFamilyMastered: familyMasteredHelper,
  }
}
