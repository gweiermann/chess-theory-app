export class TopicNotFoundError extends Error {
  readonly topicId: string

  constructor(topicId: string) {
    super(`Topic not found: ${topicId}`)
    this.name = 'TopicNotFoundError'
    this.topicId = topicId
  }
}

export const isTopicNotFoundError = (err: unknown): err is TopicNotFoundError =>
  err instanceof TopicNotFoundError
