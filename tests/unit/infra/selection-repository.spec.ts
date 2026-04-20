import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalStorageSelectionRepository } from '~/infra/selection-repository'
import type { CurrentSelection } from '~/infra/selection-repository'

const createMemoryStorage = (): Storage => {
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

describe('selectionRepository', () => {
  let storage: Storage
  beforeEach(() => { storage = createMemoryStorage() })

  it('returns null when no selection has been stored', () => {
    const repo = createLocalStorageSelectionRepository(storage)
    expect(repo.get()).toBeNull()
  })

  it('round-trips a topic-focus selection', () => {
    const repo = createLocalStorageSelectionRepository(storage)
    const sel: CurrentSelection = { topicId: 'e4', focus: { kind: 'topic' } }
    repo.set(sel)
    expect(repo.get()).toEqual(sel)
  })

  it('round-trips a family-focus selection', () => {
    const repo = createLocalStorageSelectionRepository(storage)
    const sel: CurrentSelection = {
      topicId: 'e4',
      focus: { kind: 'family', familyId: 'sicilian-defense' },
    }
    repo.set(sel)
    expect(repo.get()).toEqual(sel)
  })

  it('round-trips a line-focus selection', () => {
    const repo = createLocalStorageSelectionRepository(storage)
    const sel: CurrentSelection = {
      topicId: 'e4',
      focus: { kind: 'line', lineId: 'sicilian-najdorf' },
    }
    repo.set(sel)
    expect(repo.get()).toEqual(sel)
  })

  it('clear removes the stored selection', () => {
    const repo = createLocalStorageSelectionRepository(storage)
    repo.set({ topicId: 'e4', focus: { kind: 'topic' } })
    repo.clear()
    expect(repo.get()).toBeNull()
  })

  it('returns null for malformed stored data', () => {
    storage.setItem('chess-theory:v1:selection', '{not json')
    const repo = createLocalStorageSelectionRepository(storage)
    expect(repo.get()).toBeNull()
  })

  it('rejects selections with an unknown focus kind', () => {
    storage.setItem(
      'chess-theory:v1:selection',
      JSON.stringify({ topicId: 'e4', focus: { kind: 'whatever' } }),
    )
    const repo = createLocalStorageSelectionRepository(storage)
    expect(repo.get()).toBeNull()
  })
})
