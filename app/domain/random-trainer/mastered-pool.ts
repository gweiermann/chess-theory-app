import type { Line, LineProgress, Topic } from '~/domain/types'

/**
 * Collect the `Line` objects (with their SAN moves and user side) for every
 * line the user has marked as mastered, across all loaded topics. This is the
 * "learned pool" the random trainer draws from.
 */
export const collectMasteredLines = (
  topics: readonly Topic[],
  progress: Record<string, LineProgress[]>,
): Line[] => {
  const masteredByTopic = new Map<string, Set<string>>()
  for (const [topicId, entries] of Object.entries(progress)) {
    const ids = entries
      .filter((e) => e.status === 'mastered')
      .map((e) => e.lineId)
    if (ids.length > 0) masteredByTopic.set(topicId, new Set(ids))
  }

  const collected: Line[] = []
  for (const topic of topics) {
    const wanted = masteredByTopic.get(topic.id)
    if (!wanted) continue
    for (const family of topic.families) {
      for (const line of family.lines) {
        if (wanted.has(line.id)) collected.push(line)
      }
    }
  }
  return collected
}
