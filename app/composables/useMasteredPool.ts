import { ref, type Ref } from 'vue'
import { collectMasteredLines } from '~/domain/random-trainer/mastered-pool'
import type { Line } from '~/domain/types'

interface UseMasteredPoolState {
  lines: Ref<Line[] | null>
  loading: Ref<boolean>
  error: Ref<Error | null>
  load: () => Promise<Line[]>
}

let cached: UseMasteredPoolState | null = null

/**
 * Loads the "learned pool": every mastered line across all topics, as real
 * `Line` objects (with SAN moves and the user's side) so the random trainer
 * can build its practice tree.
 */
export const useMasteredPool = (): UseMasteredPoolState => {
  if (cached) return cached

  const { $repositories } = useNuxtApp()
  const lines = ref<Line[] | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const load = async (): Promise<Line[]> => {
    if (lines.value) return lines.value
    loading.value = true
    error.value = null
    try {
      // listAll() needs no topic scope, but the factory requires a context.
      const progressRepo = $repositories.createProgressRepository({ topics: [] })
      const progress = await progressRepo.listAll()
      const topicIds = Object.keys(progress).filter(
        (id) => progress[id]?.some((p) => p.status === 'mastered'),
      )
      if (topicIds.length === 0) {
        lines.value = []
        return []
      }
      const topics = await Promise.all(
        topicIds.map((id) => $repositories.openings.loadTopic(id)),
      )
      const result = collectMasteredLines(topics, progress)
      lines.value = result
      return result
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      loading.value = false
    }
  }

  cached = { lines, loading, error, load }
  return cached
}
