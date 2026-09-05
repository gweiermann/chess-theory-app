import type { Line, LineProgress, Topic } from '~/domain/types'

/**
 * A mastered line plus the family (grouping) context it lives under. The
 * random trainer's focus mode groups mastered content by family, so the pool
 * carries the family id and display name alongside the plain line.
 */
export interface MasteredLine extends Line {
  topicId: string
  familyId: string
  familyName: string
}

/**
 * Collect the `MasteredLine` objects (with their SAN moves, user side and
 * family) for every line the user has marked as mastered, across all loaded
 * topics. This is the "learned pool" the random trainer draws from.
 */
export const collectMasteredLines = (
  topics: readonly Topic[],
  progress: Record<string, LineProgress[]>,
): MasteredLine[] => {
  const masteredByTopic = new Map<string, Set<string>>()
  for (const [topicId, entries] of Object.entries(progress)) {
    const ids = entries
      .filter((e) => e.status === 'mastered')
      .map((e) => e.lineId)
    if (ids.length > 0) masteredByTopic.set(topicId, new Set(ids))
  }

  const collected: MasteredLine[] = []
  for (const topic of topics) {
    const wanted = masteredByTopic.get(topic.id)
    if (!wanted) continue
    for (const family of topic.families) {
      for (const line of family.lines) {
        if (wanted.has(line.id)) {
          collected.push({
            ...line,
            topicId: topic.id,
            familyId: family.id,
            familyName: family.name,
          })
        }
      }
    }
  }
  return collected
}
