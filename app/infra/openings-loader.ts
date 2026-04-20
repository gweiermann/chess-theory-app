import type { Topic } from '~/domain/types'
import type { OpeningsIndex } from '~/domain/data/split-dataset'

export interface OpeningsLoader {
  loadIndex(): Promise<OpeningsIndex>
  loadTopic(id: string): Promise<Topic>
}

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '')

export const createHttpOpeningsLoader = (
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): OpeningsLoader => {
  const base = stripTrailingSlash(baseUrl)
  const indexUrl = `${base}/index.json`
  const topicUrl = (id: string) => `${base}/topics/${id}.json`

  let indexCache: OpeningsIndex | null = null
  let indexInflight: Promise<OpeningsIndex> | null = null
  const topicCache = new Map<string, Topic>()
  const topicInflight = new Map<string, Promise<Topic>>()

  const loadIndex = async (): Promise<OpeningsIndex> => {
    if (indexCache) return indexCache
    if (indexInflight) return indexInflight
    indexInflight = (async () => {
      const res = await fetchImpl(indexUrl)
      if (!res.ok) {
        throw new Error(
          `Failed to load openings index: ${res.status} ${res.statusText}`,
        )
      }
      const json = (await res.json()) as OpeningsIndex
      indexCache = json
      return json
    })()
    try {
      return await indexInflight
    } finally {
      indexInflight = null
    }
  }

  const loadTopic = async (id: string): Promise<Topic> => {
    const cached = topicCache.get(id)
    if (cached) return cached
    const inflight = topicInflight.get(id)
    if (inflight) return inflight

    const promise = (async () => {
      const res = await fetchImpl(topicUrl(id))
      if (!res.ok) {
        throw new Error(
          `Failed to load topic '${id}': ${res.status} ${res.statusText}`,
        )
      }
      const json = (await res.json()) as Topic
      topicCache.set(id, json)
      return json
    })()
    topicInflight.set(id, promise)
    try {
      return await promise
    } finally {
      topicInflight.delete(id)
    }
  }

  return { loadIndex, loadTopic }
}
