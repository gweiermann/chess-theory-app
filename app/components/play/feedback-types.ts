export type FeedbackKind = 'correct' | 'wrong'

export interface FeedbackPayload {
  kind: FeedbackKind
  played: string
  expected?: string
  /** All valid learned continuations, shown as a multi-answer hint (wrong move / Hilfe). */
  continuations?: string[]
}
