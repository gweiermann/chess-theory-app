import type { LineProgress } from '~/domain/types'

export interface ProgressRepository {
  getLine(id: string): Promise<LineProgress>
  saveLine(progress: LineProgress): Promise<void>
  listByTopic(topicId: string): Promise<LineProgress[]>
  /** Returns every stored entry across all topics. Topic context is not required to call this. */
  listAll(): Promise<Record<string, LineProgress[]>>
  reset(topicId?: string): Promise<void>
}
