import type {
  Family,
  OpeningLine,
  Side,
  Mode,
  SavedSession,
  Settings,
  MoveInput,
  Unsubscribe,
  LearningSnapshot,
} from '../shared'
import type { BoardSession } from '../board/public'
import type { LearnerRepository } from '../learning/public'
export type Phase = 'guided' | 'recall' | 'sparring' | 'complete'
export type Message =
  | 'ready'
  | 'correct'
  | 'retry'
  | 'solution'
  | 'outside'
  | 'illegal'
  | 'new'
  | 'premove'
  | 'premove-cancelled'
  | 'recall'
  | 'repeat'
  | 'complete'
  | 'stale-session'
export interface TrainingSnapshot {
  status: 'player' | 'opponent' | 'complete' | 'error'
  phase: Phase
  mode: Mode
  side: Side
  line: OpeningLine
  expectedSan: string | null
  available: readonly string[]
  cleanRepetitions: number
  targetRepetitions: number
  round: number
  mistakes: number
  recalled: number
  assisted: number
  message: Message
  newMaterial: boolean
  persistenceError: string | null
}
export interface TrainingOptions {
  board: BoardSession
  repository: LearnerRepository
  family: Family
  datasetRevision: string
  settings: Settings
  learning?: LearningSnapshot
  random?: () => number
  now?: () => number
  opponentDelayMs?: number
  resetDelayMs?: number
}
export interface TrainingController {
  start(lineId: string, mode: Mode, side: Side, saved?: SavedSession): void
  snapshot(): Readonly<TrainingSnapshot>
  submit(move: MoveInput): void
  requestHelp(): void
  requestSuggestion(): void
  restart(): void
  skip(): void
  viewHistory(ply: number | null): void
  retrySaving(): Promise<void>
  subscribe(listener: () => void): Unsubscribe
  dispose(): void
}
