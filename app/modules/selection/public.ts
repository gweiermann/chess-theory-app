import type { MistakeBranch } from '../mistakes'
import type {
  LearningOutcome,
  PracticeIntent,
  OpeningLine,
  Progress,
  ReviewMemory,
  Side,
  Mode,
} from '../shared'
export interface SelectionInput {
  lines: readonly OpeningLine[]
  progress: Readonly<Record<string, Progress>>
  memories: Readonly<Record<string, ReviewMemory>>
  side: Side
  mode: Mode
  now: number
  random: () => number
  lastLineId?: string
  activity?: readonly LearningOutcome[]
  practiceIntent?: PracticeIntent
}
export type LearningOrderInput = Pick<
  SelectionInput,
  'lines' | 'progress' | 'side' | 'lastLineId'
>
export interface LessonChoice {
  line: OpeningLine
  reason: 'unlearned' | 'review' | 'variety'
}
export interface ReplyInput extends SelectionInput {
  targetLineId?: string
  history: readonly string[]
  /** Retained for saved settings compatibility; unfamiliar paths remain playable. */
  allowNew: boolean
}
export interface ReplyChoice {
  san: string
  newMaterial: boolean
}
export interface MistakeSelectionInput extends SelectionInput {
  branches: readonly MistakeBranch[]
  unseenOnly?: boolean
}
export interface SuggestionInput {
  practiceIntent?: PracticeIntent
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
