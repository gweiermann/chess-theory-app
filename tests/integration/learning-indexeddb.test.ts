import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import { createIndexedDbRepository } from '../../app/modules/learning'
import { DEFAULT_SETTINGS, responseKey } from '../../app/modules/shared'
import type { LearningOutcome } from '../../app/modules/shared'

const event = (changes: Partial<LearningOutcome> = {}): LearningOutcome => ({
  id: 'first',
  at: 1000,
  lineId: 'italian',
  familyId: 'italian',
  side: 'white',
  mode: 'guided',
  positionKey: 'initial',
  move: 'e4',
  grade: 'recalled',
  mistakes: 0,
  completed: true,
  cleanRepetitions: 5,
  datasetRevision: 'dataset-1',
  ...changes,
})
async function overwrite(factory: IDBFactory, value: unknown) {
  await new Promise<void>((resolve, reject) => {
    const request = factory.open('chess-theory-rebuild-v1', 1)
    request.onsuccess = () => {
      const transaction = request.result.transaction('learner', 'readwrite')
      transaction.objectStore('learner').put(value, 'state')
      transaction.oncomplete = () => {
        request.result.close()
        resolve()
      }
      transaction.onabort = () => reject(transaction.error)
    }
    request.onerror = () => reject(request.error)
  })
}
describe('durable learner repository', () => {
  it('persists one atomic learning outcome and deduplicates after reopening', async () => {
    const indexedDB = new IDBFactory()
    const first = createIndexedDbRepository({ indexedDB })
    expect(await first.record(event())).toEqual({ status: 'saved' })
    first.close()
    const second = createIndexedDbRepository({ indexedDB })
    expect(await second.record(event())).toEqual({ status: 'duplicate' })
    const snapshot = await second.load()
    expect(snapshot.activity).toHaveLength(1)
    expect(snapshot.progress['white:italian']?.status).toBe('mastered')
    expect(
      snapshot.memories[responseKey('italian', 'white', 'initial', 'e4')]
        ?.attempts,
    ).toBe(1)
    second.close()
  })
  it('serializes concurrent writes from separate repositories without losing outcomes', async () => {
    const indexedDB = new IDBFactory()
    const first = createIndexedDbRepository({ indexedDB })
    const second = createIndexedDbRepository({ indexedDB })
    const results = await Promise.all([
      first.record(event()),
      second.record(event()),
      second.record(event({ id: 'second', grade: 'retried', mistakes: 1 })),
    ])
    expect(results.filter((result) => result.status === 'saved')).toHaveLength(
      2,
    )
    expect(
      results.filter((result) => result.status === 'duplicate'),
    ).toHaveLength(1)
    const state = await first.load()
    expect(state.activity).toHaveLength(2)
    expect(
      state.memories[responseKey('italian', 'white', 'initial', 'e4')]
        ?.attempts,
    ).toBe(2)
    first.close()
    second.close()
  })
  it.each(['version', 'settings', 'progress', 'memory', 'session'])(
    'ignores corrupt %s state and recovers on the next valid write',
    async (corruption) => {
      const indexedDB = new IDBFactory()
      const repo = createIndexedDbRepository({ indexedDB })
      await repo.record(event())
      const snapshot = await repo.load()
      const envelope = { version: 1, snapshot, eventIds: ['first'] }
      if (corruption === 'version') envelope.version = 99
      if (corruption === 'settings') snapshot.settings.repetitions = -5
      if (corruption === 'progress')
        snapshot.progress['white:italian']!.cleanRepetitions = Infinity
      if (corruption === 'memory')
        snapshot.memories[
          responseKey('italian', 'white', 'initial', 'e4')
        ]!.dueAt = NaN
      if (corruption === 'session')
        Object.assign(snapshot, { session: { version: 1, moves: ['illegal'] } })
      await overwrite(indexedDB, envelope)
      expect((await repo.load()).activity).toEqual([])
      expect((await repo.load()).settings).toEqual(DEFAULT_SETTINGS)
      expect(await repo.record(event({ id: 'recovered' }))).toEqual({
        status: 'saved',
      })
      repo.close()
      const reopened = createIndexedDbRepository({ indexedDB })
      expect((await reopened.load()).activity.map((item) => item.id)).toEqual([
        'recovered',
      ])
      reopened.close()
    },
  )
  it('reports write failure, rolls back every learner record, and permits a later retry', async () => {
    const indexedDB = new IDBFactory()
    const repo = createIndexedDbRepository({ indexedDB })
    await repo.load()
    const failure = vi
      .spyOn(IDBObjectStore.prototype, 'put')
      .mockImplementationOnce(() => {
        throw new DOMException('Disk full', 'QuotaExceededError')
      })
    try {
      expect((await repo.record(event())).status).toBe('failed')
    } finally {
      failure.mockRestore()
    }
    const unchanged = await repo.load()
    expect(unchanged.activity).toEqual([])
    expect(unchanged.progress).toEqual({})
    expect(unchanged.memories).toEqual({})
    expect(await repo.record(event())).toEqual({ status: 'saved' })
    repo.close()
  })
  it('retains durable event deduplication after the bounded activity history drops an event', async () => {
    const indexedDB = new IDBFactory()
    const repo = createIndexedDbRepository({ indexedDB })
    for (let index = 0; index < 501; index++)
      await repo.record(event({ id: `event-${index}` }))
    repo.close()
    const reopened = createIndexedDbRepository({ indexedDB })
    expect((await reopened.load()).activity).toHaveLength(500)
    expect(await reopened.record(event({ id: 'event-0' }))).toEqual({
      status: 'duplicate',
    })
    expect(
      (await reopened.load()).memories[
        responseKey('italian', 'white', 'initial', 'e4')
      ]?.attempts,
    ).toBe(501)
    reopened.close()
  })
  it('rejects loading and reports saves when opening browser storage fails', async () => {
    const factory = {
      open() {
        throw new Error('Storage disabled')
      },
    } as unknown as IDBFactory
    const repo = createIndexedDbRepository({ indexedDB: factory })
    await expect(repo.load()).rejects.toThrow('Storage disabled')
    expect(await repo.record(event())).toEqual({
      status: 'failed',
      message: 'Storage disabled',
    })
    repo.close()
  })
  it('rejects sparse persisted activity rather than loading missing records', async () => {
    const indexedDB = new IDBFactory()
    const repo = createIndexedDbRepository({ indexedDB })
    const snapshot = await repo.load()
    snapshot.activity = Array<LearningOutcome>(1)
    await overwrite(indexedDB, { version: 1, snapshot, eventIds: [] })
    expect((await repo.load()).activity).toEqual([])
    repo.close()
  })
  it('bounds a hanging storage open and allows a subsequent retry', async () => {
    vi.useFakeTimers()
    const indexedDB = new IDBFactory()
    const original = indexedDB.open.bind(indexedDB)
    const open = vi
      .spyOn(indexedDB, 'open')
      .mockImplementationOnce(() => ({}) as IDBOpenDBRequest)
      .mockImplementation(original)
    const repo = createIndexedDbRepository({ indexedDB })
    try {
      const pending = repo.record(event())
      await vi.advanceTimersByTimeAsync(1500)
      expect(await pending).toEqual({
        status: 'failed',
        message: 'Browser storage did not open in time',
      })
      vi.useRealTimers()
      expect(await repo.record(event())).toEqual({ status: 'saved' })
    } finally {
      vi.useRealTimers()
      open.mockRestore()
      repo.close()
    }
  })
})
