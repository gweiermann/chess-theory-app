import type { LearnerRepository } from './public'
import { repository } from './repository'
import { copy, fresh, validEnvelope } from './state'
import type { Envelope } from './state'
import type { Change } from './repository'

export function createIndexedDbRepository(
  options: { name?: string; indexedDB?: IDBFactory } = {},
): LearnerRepository {
  let database: IDBDatabase | null = null
  let opening: Promise<IDBDatabase> | null = null
  let disposed = false
  const factory = options.indexedDB ?? globalThis.indexedDB
  function open(): Promise<IDBDatabase> {
    if (disposed) return Promise.reject(new Error('Repository is closed'))
    if (database) return Promise.resolve(database)
    if (opening) return opening
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      if (!factory) {
        reject(new Error('Browser storage is unavailable'))
        return
      }
      let settled = false
      const fail = (message: string) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(new Error(message))
      }
      const timer = setTimeout(
        () => fail('Browser storage did not open in time'),
        1500,
      )
      try {
        const request = factory.open(
          options.name ?? 'chess-theory-rebuild-v1',
          1,
        )
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('learner'))
            request.result.createObjectStore('learner')
        }
        request.onerror = () =>
          fail(request.error?.message ?? 'Unable to open browser storage')
        request.onblocked = () =>
          fail('Browser storage is blocked by another tab')
        request.onsuccess = () => {
          if (settled || disposed) {
            request.result.close()
            fail('Repository is closed')
            return
          }
          settled = true
          clearTimeout(timer)
          database = request.result
          database.onversionchange = () => {
            database?.close()
            database = null
            opening = null
          }
          resolve(database)
        }
      } catch (error) {
        fail(
          error instanceof Error
            ? error.message
            : 'Unable to open browser storage',
        )
      }
    }).catch((error) => {
      opening = null
      throw error
    })
    return opening
  }
  async function transact(
    update?: Change,
  ): Promise<{ state: Envelope; status: 'saved' | 'duplicate' }> {
    const db = await open()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        'learner',
        update ? 'readwrite' : 'readonly',
      )
      const store = transaction.objectStore('learner')
      let state = fresh()
      let status: 'saved' | 'duplicate' = 'duplicate'
      let failure: unknown
      const request = store.get('state')
      request.onsuccess = () => {
        try {
          state = validEnvelope(request.result) ? copy(request.result) : fresh()
          if (update) {
            const next = update(state)
            if (next) {
              state = next
              store.put(next, 'state')
              status = 'saved'
            }
          }
        } catch (error) {
          failure = error
          transaction.abort()
        }
      }
      transaction.oncomplete = () => resolve({ state, status })
      transaction.onabort = () =>
        reject(
          failure ??
            transaction.error ??
            new Error('Learning transaction aborted'),
        )
      transaction.onerror = () => {
        failure = transaction.error ?? new Error('Learning transaction failed')
      }
    })
  }
  return repository({
    async read() {
      return (await transact()).state
    },
    async change(update) {
      return (await transact(update)).status
    },
    close() {
      disposed = true
      database?.close()
      database = null
    },
  })
}
