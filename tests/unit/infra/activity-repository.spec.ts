import { beforeEach, describe, expect, it } from 'vitest'
import {
  createLocalStorageActivityRepository,
  ACTIVITY_STORAGE_KEY,
  PER_LINE_EVENT_CAP,
} from '~/infra/activity-repository'
import type { ActivityEvent } from '~/domain/activity'

const memoryStorage = (): Storage => {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v) },
    removeItem: (k) => { data.delete(k) },
    key: (i) => Array.from(data.keys())[i] ?? null,
  }
}

const ev = (
  type: ActivityEvent['type'],
  at: number,
  extra: Partial<ActivityEvent> = {},
): ActivityEvent => ({
  topicId: 'e4',
  lineId: 'l',
  type,
  at,
  ...extra,
})

describe('LocalStorageActivityRepository', () => {
  let storage: Storage
  beforeEach(() => { storage = memoryStorage() })

  it('append + listByLine round-trips events for a single line', async () => {
    const repo = createLocalStorageActivityRepository(storage)
    await repo.append(ev('session_started', 1))
    await repo.append(ev('mistake', 2, { expected: 'e4', played: 'e5' }))

    const list = await repo.listByLine('l')
    expect(list).toHaveLength(2)
    expect(list[0]?.type).toBe('session_started')
    expect(list[1]?.played).toBe('e5')
  })

  it('listByLine only returns events for the requested line', async () => {
    const repo = createLocalStorageActivityRepository(storage)
    await repo.append(ev('mistake', 1, { lineId: 'a' }))
    await repo.append(ev('mistake', 2, { lineId: 'b' }))
    await repo.append(ev('mistake', 3, { lineId: 'a' }))

    expect(await repo.listByLine('a')).toHaveLength(2)
    expect(await repo.listByLine('b')).toHaveLength(1)
    expect(await repo.listByLine('zzz')).toHaveLength(0)
  })

  it('listAll groups events by line', async () => {
    const repo = createLocalStorageActivityRepository(storage)
    await repo.append(ev('mistake', 1, { lineId: 'a' }))
    await repo.append(ev('mistake', 2, { lineId: 'b' }))
    const all = await repo.listAll()
    expect(Object.keys(all).sort()).toEqual(['a', 'b'])
  })

  it('statsForLine aggregates events using the domain helper', async () => {
    const repo = createLocalStorageActivityRepository(storage)
    await repo.append(ev('session_started', 1))
    await repo.append(ev('rep_completed', 2, { durationMs: 5_000, mistakeCount: 1 }))
    await repo.append(ev('rep_completed', 3, { durationMs: 7_000, mistakeCount: 1 }))
    const stats = await repo.statsForLine('l')
    expect(stats.repCount).toBe(2)
    expect(stats.averageRepDurationMs).toBe(6_000)
  })

  it('reset(lineId) clears events only for that line', async () => {
    const repo = createLocalStorageActivityRepository(storage)
    await repo.append(ev('mistake', 1, { lineId: 'a' }))
    await repo.append(ev('mistake', 2, { lineId: 'b' }))
    await repo.reset('a')
    expect(await repo.listByLine('a')).toHaveLength(0)
    expect(await repo.listByLine('b')).toHaveLength(1)
  })

  it('reset() with no arg clears every line', async () => {
    const repo = createLocalStorageActivityRepository(storage)
    await repo.append(ev('mistake', 1, { lineId: 'a' }))
    await repo.append(ev('mistake', 2, { lineId: 'b' }))
    await repo.reset()
    const all = await repo.listAll()
    expect(Object.keys(all)).toHaveLength(0)
  })

  it('caps stored events per line so localStorage cannot grow unbounded', async () => {
    const repo = createLocalStorageActivityRepository(storage)
    for (let i = 0; i < PER_LINE_EVENT_CAP + 50; i += 1) {
      await repo.append(ev('mistake', i))
    }
    const list = await repo.listByLine('l')
    expect(list).toHaveLength(PER_LINE_EVENT_CAP)
    // Oldest events were rotated out, newest remain.
    expect(list[0]?.at).toBe(50)
    expect(list[list.length - 1]?.at).toBe(PER_LINE_EVENT_CAP + 49)
  })

  it('tolerates malformed stored data by treating it as empty', async () => {
    storage.setItem(ACTIVITY_STORAGE_KEY, 'not-json')
    const repo = createLocalStorageActivityRepository(storage)
    expect(await repo.listByLine('l')).toEqual([])
    await repo.append(ev('mistake', 1))
    expect(await repo.listByLine('l')).toHaveLength(1)
  })
})
