import type { LineProgress, ProgressStatus } from './types'

export interface RecentActivityEntry {
  topicId: string
  lineId: string
  status: ProgressStatus
  lastPracticedAt: number
}

export interface RecentActivityOptions {
  limit?: number
}

export const recentActivity = (
  byTopic: Record<string, readonly LineProgress[]>,
  options: RecentActivityOptions = {},
): RecentActivityEntry[] => {
  const entries: RecentActivityEntry[] = []
  for (const [topicId, list] of Object.entries(byTopic)) {
    for (const p of list) {
      if (p.lastPracticedAt === undefined) continue
      entries.push({
        topicId,
        lineId: p.lineId,
        status: p.status,
        lastPracticedAt: p.lastPracticedAt,
      })
    }
  }
  entries.sort((a, b) => b.lastPracticedAt - a.lastPracticedAt)
  if (options.limit !== undefined) return entries.slice(0, options.limit)
  return entries
}
