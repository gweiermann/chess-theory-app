import { ref, type Ref } from 'vue'
import type { OpeningsIndex, TopicSummary } from '~/domain/data/split-dataset'

interface OpeningsIndexState {
  loading: Ref<boolean>
  error: Ref<Error | null>
  index: Ref<OpeningsIndex | null>
  load: () => Promise<OpeningsIndex>
  topicSummary: (id: string) => TopicSummary | undefined
}

let cached: OpeningsIndexState | null = null

export const useOpeningsIndex = (): OpeningsIndexState => {
  if (cached) return cached

  const { $repositories } = useNuxtApp()
  const index = ref<OpeningsIndex | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const load = async (): Promise<OpeningsIndex> => {
    if (index.value) return index.value
    loading.value = true
    error.value = null
    try {
      const idx = await $repositories.openings.loadIndex()
      index.value = idx
      return idx
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      loading.value = false
    }
  }

  const topicSummary = (id: string): TopicSummary | undefined =>
    index.value?.topics.find((t) => t.id === id)

  cached = { loading, error, index, load, topicSummary }
  return cached
}
