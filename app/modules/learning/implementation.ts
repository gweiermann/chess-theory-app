import type { LearnerRepository } from './public'
import { repository } from './repository'
import { fresh } from './state'
import { validSession } from './state'
import type { SavedSession } from '../shared'

export function isSavedSession(value: unknown): value is SavedSession {
  return value !== null && validSession(value)
}

export function createMemoryRepository(): LearnerRepository {
  let state = fresh()
  return repository({
    async read() {
      return state
    },
    async change(update) {
      const next = update(state)
      if (!next) return 'duplicate'
      state = next
      return 'saved'
    },
    close() {},
  })
}

export { createIndexedDbRepository } from './indexeddb'
