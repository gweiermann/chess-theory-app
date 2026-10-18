import type {
  LearningOutcome,
  LearningSnapshot,
  SavedSession,
  Settings,
  Unsubscribe,
} from '../shared'
export type {
  LearningOutcome,
  LearningSnapshot,
  Settings,
  SavedSession,
} from '../shared'
export type SaveResult =
  | { status: 'saved' | 'duplicate' }
  | { status: 'failed'; message: string }
export interface LearnerRepository {
  load(): Promise<LearningSnapshot>
  record(outcome: LearningOutcome): Promise<SaveResult>
  updateSettings(settings: Settings): Promise<SaveResult>
  saveSession(session: SavedSession | null): Promise<SaveResult>
  subscribe(listener: () => void): Unsubscribe
  close(): void
}
