import type { OpeningLine, Progress, ReviewMemory, Side, Mode } from '../shared'
export interface SelectionInput {
  lines: readonly OpeningLine[]
  progress: Readonly<Record<string, Progress>>
  memories: Readonly<Record<string, ReviewMemory>>
  side: Side
  mode: Mode
  now: number
  random: () => number
  lastLineId?: string
}
export interface LessonChoice {
  line: OpeningLine
  reason: 'unlearned' | 'review' | 'variety'
}
export interface ReplyInput extends SelectionInput {
  history: readonly string[]
  allowNew: boolean
}
export interface ReplyChoice {
  san: string
  newMaterial: boolean
}
export interface SuggestionInput {
  familyId: string
  side: Side
  positionKey: string
  moves: readonly string[]
  memories: Readonly<Record<string, ReviewMemory>>
  now: number
}
export interface Suggestion {
  san: string
  reason: 'difficult' | 'due' | 'less-practiced'
}
