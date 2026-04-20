import type { OpeningsDataset, Topic } from '../types'

export interface TopicSummary {
  id: string
  label: string
  firstMove: string
  totalFamilies: number
  totalLines: number
  familyIds: string[]
}

export interface OpeningsIndex {
  generatedAt: string
  topics: TopicSummary[]
}

export interface SplitDataset {
  index: OpeningsIndex
  topics: Map<string, Topic>
}

const summarize = (topic: Topic): TopicSummary => ({
  id: topic.id,
  label: topic.label,
  firstMove: topic.firstMove,
  totalFamilies: topic.families.length,
  totalLines: topic.families.reduce((sum, f) => sum + f.lines.length, 0),
  familyIds: topic.families.map((f) => f.id),
})

export const splitDataset = (dataset: OpeningsDataset): SplitDataset => {
  const index: OpeningsIndex = {
    generatedAt: dataset.generatedAt,
    topics: dataset.topics.map(summarize),
  }
  const topics = new Map<string, Topic>()
  for (const topic of dataset.topics) topics.set(topic.id, topic)
  return { index, topics }
}
