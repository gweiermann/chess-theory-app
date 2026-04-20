import { ref, watch, type Ref } from 'vue'
import type { Topic } from '~/domain/types'

interface UseTopicState {
  topic: Ref<Topic | null>
  loading: Ref<boolean>
  error: Ref<Error | null>
  load: (id: string) => Promise<Topic>
}

export const useTopic = (idRef: Ref<string | null | undefined>): UseTopicState => {
  const { $repositories } = useNuxtApp()
  const topic = ref<Topic | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const load = async (id: string): Promise<Topic> => {
    loading.value = true
    error.value = null
    try {
      const t = await $repositories.openings.loadTopic(id)
      topic.value = t
      return t
    } catch (err) {
      error.value = err as Error
      topic.value = null
      throw err
    } finally {
      loading.value = false
    }
  }

  watch(
    idRef,
    async (id) => {
      if (!id) {
        topic.value = null
        return
      }
      try {
        await load(id)
      } catch {
        // surfaced via `error` ref
      }
    },
    { immediate: true },
  )

  return { topic, loading, error, load }
}
