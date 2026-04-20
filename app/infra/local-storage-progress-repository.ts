import { initialProgress } from '~/domain/progress'
import type { LineProgress, OpeningsDataset, Topic } from '~/domain/types'
import type { ProgressRepository } from './progress-repository'

export const STORAGE_KEY = 'chess-theory:v1:progress'

interface StoredShape {
  version: 1
  byTopic: Record<string, Record<string, LineProgress>>
}

const emptyShape = (): StoredShape => ({ version: 1, byTopic: {} })

const readShape = (storage: Storage): StoredShape => {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return emptyShape()
    const parsed = JSON.parse(raw) as Partial<StoredShape>
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return emptyShape()
    }
    return { version: 1, byTopic: parsed.byTopic ?? {} }
  } catch {
    return emptyShape()
  }
}

const writeShape = (storage: Storage, shape: StoredShape): void => {
  storage.setItem(STORAGE_KEY, JSON.stringify(shape))
}

const findTopicForLine = (
  topics: readonly Topic[],
  lineId: string,
): string | undefined => {
  for (const topic of topics) {
    for (const family of topic.families) {
      if (family.lines.some((l) => l.id === lineId)) return topic.id
    }
  }
  return undefined
}

const collectLineIdsForTopic = (
  topics: readonly Topic[],
  topicId: string,
): string[] => {
  const topic = topics.find((t) => t.id === topicId)
  if (!topic) return []
  return topic.families.flatMap((f) => f.lines.map((l) => l.id))
}

export interface RepositoryContext {
  topics: readonly Topic[]
}

export const createLocalStorageProgressRepository = (
  storage: Storage,
  contextOrDataset: RepositoryContext | OpeningsDataset | Topic,
): ProgressRepository => {
  const topics: readonly Topic[] = (() => {
    if ('topics' in contextOrDataset && Array.isArray(contextOrDataset.topics)) {
      return contextOrDataset.topics
    }
    if ('id' in contextOrDataset && 'families' in contextOrDataset) {
      return [contextOrDataset as Topic]
    }
    return []
  })()

  const getLine = async (id: string): Promise<LineProgress> => {
    const shape = readShape(storage)
    const topicId = findTopicForLine(topics, id)
    if (!topicId) return initialProgress(id)
    return shape.byTopic[topicId]?.[id] ?? initialProgress(id)
  }

  const saveLine = async (progress: LineProgress): Promise<void> => {
    const topicId = findTopicForLine(topics, progress.lineId)
    if (!topicId) return
    const shape = readShape(storage)
    const existing = shape.byTopic[topicId] ?? {}
    shape.byTopic[topicId] = { ...existing, [progress.lineId]: progress }
    writeShape(storage, shape)
  }

  const listByTopic = async (topicId: string): Promise<LineProgress[]> => {
    const shape = readShape(storage)
    const stored = shape.byTopic[topicId] ?? {}
    const lineIds = collectLineIdsForTopic(topics, topicId)
    return lineIds.map((id) => stored[id] ?? initialProgress(id))
  }

  const listAll = async (): Promise<Record<string, LineProgress[]>> => {
    const shape = readShape(storage)
    const out: Record<string, LineProgress[]> = {}
    for (const [topicId, entries] of Object.entries(shape.byTopic)) {
      out[topicId] = Object.values(entries)
    }
    return out
  }

  const reset = async (topicId?: string): Promise<void> => {
    if (!topicId) {
      writeShape(storage, emptyShape())
      return
    }
    const shape = readShape(storage)
    const { [topicId]: _omit, ...rest } = shape.byTopic
    shape.byTopic = rest
    writeShape(storage, shape)
  }

  return { getLine, saveLine, listByTopic, listAll, reset }
}
