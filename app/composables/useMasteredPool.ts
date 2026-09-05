import { ref, type Ref } from 'vue'
import {
  collectMasteredLines,
  type MasteredLine,
} from '~/domain/random-trainer/mastered-pool'

interface UseMasteredPoolState {
  lines: Ref<MasteredLine[] | null>
  loading: Ref<boolean>
  error: Ref<Error | null>
  load: () => Promise<MasteredLine[]>
}

let cached: UseMasteredPoolState | null = null

/**
 * Loads the "learned pool": every mastered line across all topics, as real
 * `MasteredLine` objects (with SAN moves, the user's side and its family) so
 * the random trainer can build its practice tree and group rounds by family.
 */
export const useMasteredPool = (): UseMasteredPoolState => {
  if (cached) return cached

  const { $repositories } = useNuxtApp()
  const lines = ref<MasteredLine[] | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const load = async (): Promise<MasteredLine[]> => {
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
