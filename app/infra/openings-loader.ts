import { treeFileToFamily } from '~/domain/data/family-tree-file'
import type { Topic } from '~/domain/types'
import { TopicNotFoundError } from '~/infra/topic-not-found-error'
import type { OpeningsIndex, TopicIndexFile } from '~/domain/data/split-dataset'

export interface OpeningsLoader {
  loadIndex(): Promise<OpeningsIndex>
  loadTopic(id: string): Promise<Topic>
}

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '')

/** Static hosts often answer unknown `*.json` paths with SPA `index.html` (200 OK). Treat as missing topic. */
const readTopicShellJson = async (topicId: string, res: Response): Promise<TopicIndexFile> => {
  const text = await res.text()
  const trimmed = text.trimStart()
  if (trimmed.startsWith('<')) {
    throw new TopicNotFoundError(topicId)
  }
  try {
    return JSON.parse(text) as TopicIndexFile
  } catch {
    throw new Error(`Failed to parse topic index for '${topicId}'`)
  }
}

export const createHttpOpeningsLoader = (
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): OpeningsLoader => {
  const base = stripTrailingSlash(baseUrl)
  const indexUrl = `${base}/index.json`
  const topicIndexUrl = (topicId: string) => `${base}/${topicId}/index.json`
  const familyUrl = (topicId: string, familyId: string) =>
    `${base}/${topicId}/families/${familyId}.json`

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
      const shellRes = await fetchImpl(topicIndexUrl(id))
      if (!shellRes.ok) {
        if (shellRes.status === 404) {
          throw new TopicNotFoundError(id)
        }
        throw new Error(
          `Failed to load topic '${id}': ${shellRes.status} ${shellRes.statusText}`,
        )
      }
      const shell = await readTopicShellJson(id, shellRes)
      const families = await Promise.all(
        shell.families.map(async (row) => {
          const res = await fetchImpl(familyUrl(id, row.id))
          if (!res.ok) {
            throw new Error(
              `Failed to load family '${row.id}' for topic '${id}': ${res.status} ${res.statusText}`,
            )
          }
          return treeFileToFamily(await res.json())
        }),
      )
      const topic: Topic = {
        id: shell.id,
        label: shell.label,
        firstMove: shell.firstMove,
        families,
      }
      topicCache.set(id, topic)
      return topic
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
