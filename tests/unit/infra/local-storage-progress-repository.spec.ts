import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalStorageProgressRepository } from '~/infra/local-storage-progress-repository'
import type { Topic } from '~/domain/types'

const memoryStorage = (): Storage => {
  const store = new Map<string, string>()
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => {
      store.set(k, String(v))
    },
    removeItem: (k) => {
      store.delete(k)
    },
    clear: () => {
      store.clear()
    },
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

const topic: Topic = {
  id: 'e4',
  firstMove: 'e4',
  label: '1.e4',
  families: [
    {
      id: 'italian',
      name: 'Italian Game',
      lines: [
        {
          id: 'a',
          eco: 'C50',
          fullName: 'Italian Game',
          pgn: '1. e4 e5',
          sanMoves: ['e4', 'e5'],
          userSide: 'white',
        },
        {
          id: 'b',
          eco: 'C53',
          fullName: 'Italian Game: Classical',
          pgn: '1. e4 e5',
          sanMoves: ['e4', 'e5'],
          userSide: 'white',
        },
      ],
      tree: { label: 'Italian Game', lineId: 'a', children: [] },
    },
  ],
}

describe('LocalStorageProgressRepository', () => {
  let storage: Storage

  beforeEach(() => {
    storage = memoryStorage()
  })

  it('returns initial progress for an unknown line', async () => {
    const repo = createLocalStorageProgressRepository(storage, topic)
    const p = await repo.getLine('a')
    expect(p).toEqual({ lineId: 'a', status: 'new', reps: 0 })
  })

  it('persists saved progress and reads it back', async () => {
    const repo = createLocalStorageProgressRepository(storage, topic)
    await repo.saveLine({
      lineId: 'a',
      status: 'in-progress',
      reps: 3,
      lastPracticedAt: 123,
    })
    const reread = createLocalStorageProgressRepository(storage, topic)
    expect(await reread.getLine('a')).toEqual({
      lineId: 'a',
      status: 'in-progress',
      reps: 3,
      lastPracticedAt: 123,
    })
  })

  it('listByTopic returns one entry per line in the topic', async () => {
    const repo = createLocalStorageProgressRepository(storage, topic)
    await repo.saveLine({
      lineId: 'a',
      status: 'mastered',
      reps: 10,
      lastPracticedAt: 1,
    })
    const list = await repo.listByTopic('e4')
    expect(list).toHaveLength(2)
    expect(list.find((p) => p.lineId === 'a')!.status).toBe('mastered')
    expect(list.find((p) => p.lineId === 'b')!.status).toBe('new')
  })

  it('reset clears progress for a topic', async () => {
    const repo = createLocalStorageProgressRepository(storage, topic)
    await repo.saveLine({
      lineId: 'a',
      status: 'mastered',
      reps: 10,
      lastPracticedAt: 1,
    })
    await repo.reset('e4')
    const list = await repo.listByTopic('e4')
    expect(list.every((p) => p.status === 'new')).toBe(true)
  })

  it('reset() with no argument clears everything', async () => {
    const repo = createLocalStorageProgressRepository(storage, topic)
    await repo.saveLine({
      lineId: 'a',
      status: 'mastered',
      reps: 10,
      lastPracticedAt: 1,
    })
    await repo.reset()
    expect(await repo.getLine('a')).toMatchObject({ status: 'new' })
  })

  it('tolerates malformed stored data by treating it as empty', async () => {
    storage.setItem('chess-theory:v1:progress', 'not-json')
    const repo = createLocalStorageProgressRepository(storage, topic)
    expect(await repo.getLine('a')).toMatchObject({ status: 'new' })
  })

  it('listAll returns saved entries grouped by topic without requiring topic context', async () => {
    const writer = createLocalStorageProgressRepository(storage, topic)
    await writer.saveLine({
      lineId: 'a',
      status: 'mastered',
      reps: 10,
      lastPracticedAt: 99,
    })
    const reader = createLocalStorageProgressRepository(storage, { topics: [] })
    const all = await reader.listAll()
    expect(all.e4).toBeDefined()
    expect(all.e4!.find((p) => p.lineId === 'a')?.status).toBe('mastered')
  })
})
