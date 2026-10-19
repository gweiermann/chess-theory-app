export type Side = 'white' | 'black'
export type MoveInput =
  | string
  | { from: string; to: string; promotion?: string }
export interface GameRecord {
  initialFen?: string
  moves: readonly string[]
}
export type Unsubscribe = () => void

export interface OpeningLine {
  id: string
  eco: string
  name: string
  familyId: string
  topicId: string
  moves: readonly string[]
  suggestedSide: Side
}
export interface FamilySummary {
  id: string
  name: string
  topicId: string
  lineCount: number
}
export interface TopicSummary {
  id: string
  name: string
  familyCount: number
  lineCount: number
}
export interface Family {
  summary: FamilySummary
  lines: readonly OpeningLine[]
}
export interface Catalog {
  version: 1
  revision: string
  topics: readonly TopicSummary[]
  families: readonly FamilySummary[]
  lineCount: number
}

export type Mode = 'guided' | 'sparring' | 'review' | 'mistakes'
export const isFreePlay = (mode: Mode) =>
  mode === 'sparring' || mode === 'mistakes'
export interface Settings {
  side: Side
  repetitions: number
  allowNew: boolean
  suggestions: 'automatic' | 'on-request'
  premoves: boolean
  autoSetup: boolean
}
export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  side: 'white',
  repetitions: 5,
  allowNew: false,
  suggestions: 'on-request',
  premoves: true,
  autoSetup: true,
})
export type OutcomeGrade =
  | 'recalled'
  | 'retried'
  | 'hinted'
  | 'suggested'
  | 'new'
  | 'skipped'
export type PracticeIntent = 'explore' | 'review'
export interface LearningOutcome {
  practiceIntent?: PracticeIntent
  kind?: 'response' | 'round' | 'exposure'
  requiredRepetitions?: number
  id: string
  at: number
  lineId: string
  familyId: string
  side: Side
  mode: Mode
  positionKey: string
  move: string
  grade: OutcomeGrade
  mistakes: number
  completed: boolean
  cleanRepetitions: number
  datasetRevision: string
}
export interface Progress {
  lineId: string
  side: Side
  status: 'practicing' | 'mastered'
  cleanRepetitions: number
  lastPracticedAt: number
}
export interface ReviewMemory {
  attempts: number
  mistakes: number
  assisted: number
  lastSeenAt: number
  dueAt: number
}
export interface SavedSession {
  practiceIntent?: PracticeIntent
  pendingReset?: boolean
  version: 1
  phase: 'guided' | 'recall' | 'sparring' | 'punish'
  challenge?: { id: string; revision: string }
  datasetRevision: string
  lineId: string
  familyId: string
  side: Side
  mode: Mode
  moves: readonly string[]
  setupPlies: number
  repetitions: number
  cleanRepetitions: number
  mistakes: number
  assisted: number
  recalled: number
  round: number
  attempt: number
  repetitionMistakes: number
  repetitionAssisted: boolean
  helped: boolean
  suggested: string | null
  allowNew: boolean
}
export interface LearningSnapshot {
  version: 1
  settings: Settings
  progress: Record<string, Progress>
  memories: Record<string, ReviewMemory>
  activity: LearningOutcome[]
  session: SavedSession | null
}
export const progressKey = (lineId: string, side: Side) => `${side}:${lineId}`
export const responseKey = (
  familyId: string,
  side: Side,
  position: string,
  move: string,
) => `${familyId}|${side}|${position}|${move}`
