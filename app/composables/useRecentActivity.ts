import { ref, type Ref } from 'vue'
import { recentActivity, type RecentActivityEntry } from '~/domain/recent-activity'
import type { LineActivityStats } from '~/domain/activity'
import type { Line, Topic } from '~/domain/types'

export interface ResolvedActivityEntry extends RecentActivityEntry {
  topicLabel: string
  line: Line | null
  familyName: string | null
  stats: LineActivityStats
}

interface UseRecentActivity {
  loading: Ref<boolean>
  entries: Ref<ResolvedActivityEntry[]>
  refresh: (limit?: number) => Promise<void>
}

export const useRecentActivity = (): UseRecentActivity => {
  const { $repositories } = useNuxtApp()
  const loading = ref(false)
  const entries = ref<ResolvedActivityEntry[]>([])

  const resolveEntry = async (
    raw: RecentActivityEntry,
    topicCache: Map<string, Topic | null>,
  ): Promise<ResolvedActivityEntry> => {
    let topic: Topic | null
    if (topicCache.has(raw.topicId)) {
      topic = topicCache.get(raw.topicId) ?? null
    } else {
      try {
        topic = await $repositories.openings.loadTopic(raw.topicId)
      } catch {
        topic = null
      }
      topicCache.set(raw.topicId, topic)
    }
    const stats = await $repositories.activity.statsForLine(raw.lineId)
    if (!topic) {
      return { ...raw, topicLabel: raw.topicId, line: null, familyName: null, stats }
    }
    for (const family of topic.families) {
      const line = family.lines.find((l) => l.id === raw.lineId)
      if (line) {
        return {
          ...raw,
          topicLabel: topic.label,
          line,
          familyName: family.name,
          stats,
        }
      }
    }
    return { ...raw, topicLabel: topic.label, line: null, familyName: null, stats }
  }

  const refresh = async (limit = 25): Promise<void> => {
    loading.value = true
    try {
      const rawByTopic = await $repositories
        .createProgressRepository({ topics: [] })
        .listAll()
      const trimmed = recentActivity(rawByTopic, { limit })
      const topicCache = new Map<string, Topic | null>()
      const resolved: ResolvedActivityEntry[] = []
      for (const e of trimmed) resolved.push(await resolveEntry(e, topicCache))
      entries.value = resolved
    } finally {
      loading.value = false
    }
  }

  return { loading, entries, refresh }
}
