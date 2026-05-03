import type { FamilyCategory, OpeningsDataset, Topic } from '../types'

export interface TopicSummary {
  id: string
  label: string
  firstMove: string
  familyCount: number
  lineCount: number
}

export interface OpeningsIndex {
  generatedAt: string
  topics: TopicSummary[]
}

/** One row in `<topicId>/index.json` — enough to render the topic shell and fetch `families/<id>.json`. */
export interface TopicFamilyIndexRow {
  id: string
  name: string
  category: FamilyCategory
  lineCount: number
}

/** Payload at `/data/openings/<topicId>/index.json`. */
export interface TopicIndexFile {
  id: string
  label: string
  firstMove: string
  families: TopicFamilyIndexRow[]
}

export interface SplitDataset {
  index: OpeningsIndex
  topics: Map<string, Topic>
}

const summarize = (topic: Topic): TopicSummary => ({
  id: topic.id,
  label: topic.label,
  firstMove: topic.firstMove,
  familyCount: topic.families.length,
  lineCount: topic.families.reduce((sum, f) => sum + f.lines.length, 0),
})

/** Shape written to `public/data/openings/<topicId>/index.json`. */
export const buildTopicIndexFile = (topic: Topic): TopicIndexFile => ({
  id: topic.id,
  label: topic.label,
  firstMove: topic.firstMove,
  families: topic.families.map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
    lineCount: f.lines.length,
  })),
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
