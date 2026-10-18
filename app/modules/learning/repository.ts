import type { LearningOutcome, SavedSession, Settings } from '../shared'
import type { LearnerRepository, SaveResult } from './public'
import {
  applyOutcome,
  copy,
  validOutcome,
  validSession,
  validSettings,
} from './state'
import type { Envelope } from './state'

export type Change = (state: Envelope) => Envelope | null
export type Storage = {
  read(): Promise<Envelope>
  change(update: Change): Promise<'saved' | 'duplicate'>
  close(): void
}
export function repository(storage: Storage): LearnerRepository {
  const listeners = new Set<() => void>()
  let closed = false
  async function write(valid: boolean, change: Change): Promise<SaveResult> {
    if (closed || !valid)
      return {
        status: 'failed',
        message: closed ? 'Repository is closed' : 'Invalid learning data',
      }
    try {
      const status = await storage.change(change)
      if (status === 'saved')
        for (const listener of listeners) {
          try {
            listener()
          } catch {
            /* A view cannot roll back a completed transaction. */
          }
        }
      return { status }
    } catch (error) {
      return {
        status: 'failed',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to save learning data',
      }
    }
  }
  return {
    async load() {
      if (closed) throw new Error('Repository is closed')
      return copy((await storage.read()).snapshot)
    },
    record(event: LearningOutcome) {
      if (!validOutcome(event)) return write(false, (state) => state)
      const captured = copy(event)
      return write(true, (state) =>
        state.eventIds.includes(captured.id)
          ? null
          : applyOutcome(state, captured),
      )
    },
    updateSettings(settings: Settings) {
      if (!validSettings(settings)) return write(false, (state) => state)
      const captured = copy(settings)
      return write(true, (state) => ({
        ...state,
        snapshot: { ...state.snapshot, settings: captured },
      }))
    },
    saveSession(session: SavedSession | null) {
      if (!validSession(session)) return write(false, (state) => state)
      const captured = copy(session)
      return write(true, (state) => ({
        ...state,
        snapshot: { ...state.snapshot, session: captured },
      }))
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close() {
      closed = true
      listeners.clear()
      storage.close()
    },
  }
}
