export type FeedbackKind = 'correct' | 'wrong'

export interface FeedbackPayload {
  kind: FeedbackKind
  played: string
  expected?: string
}
