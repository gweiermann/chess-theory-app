import { describe, expect, it } from 'vitest'
import {
  createMemoryRepository,
  isSavedSession,
} from '../../app/modules/learning'
import type { LearningOutcome, SavedSession } from '../../app/modules/shared'
import { DEFAULT_SETTINGS, responseKey } from '../../app/modules/shared'

const outcome = (changes: Partial<LearningOutcome> = {}): LearningOutcome => ({
  id: 'event-1',
  at: 1000,
  lineId: 'italian',
  familyId: 'italian',
  side: 'white',
  mode: 'guided',
  positionKey: 'start',
  move: 'e4',
  grade: 'recalled',
  mistakes: 0,
  completed: true,
  cleanRepetitions: 5,
  datasetRevision: 'source-1',
  ...changes,
})
const session = (changes: Partial<SavedSession> = {}): SavedSession => ({
  version: 1,
  datasetRevision: 'dataset-1',
  lineId: 'italian',
  familyId: 'italian',
  side: 'white',
  mode: 'guided',
  moves: ['e4', 'e5'],
  setupPlies: 2,
  repetitions: 5,
  cleanRepetitions: 0,
  mistakes: 0,
  assisted: 0,
  recalled: 0,
  round: 0,
  attempt: 0,
  helped: false,
  suggested: null,
  allowNew: false,
  phase: 'guided',
  repetitionMistakes: 0,
  repetitionAssisted: false,
  ...changes,
})

describe('learner repository', () => {
  it('rejects saved teaching phases inconsistent with their exercise mode', () => {
    expect(isSavedSession(session({ mode: 'mistakes', phase: 'punish' }))).toBe(
      false,
    )
    expect(
      isSavedSession(
        session({
          mode: 'mistakes',
          phase: 'punish',
          challenge: { id: 'fault', revision: 'analysis' },
        }),
      ),
    ).toBe(true)
    expect(
      isSavedSession(
        session({
          mode: 'guided',
          phase: 'punish',
          challenge: { id: 'fault', revision: 'analysis' },
        }),
      ),
    ).toBe(false)
    expect(isSavedSession(session({ mode: 'guided', phase: 'sparring' }))).toBe(
      false,
    )
    expect(isSavedSession(session({ mode: 'review', phase: 'guided' }))).toBe(
      false,
    )
    expect(isSavedSession(session({ mode: 'sparring', phase: 'recall' }))).toBe(
      false,
    )
    expect(isSavedSession(session({ mode: 'guided', phase: 'recall' }))).toBe(
      true,
    )
  })
  it('records a completed clean exercise exactly once and keeps returned snapshots independent', async () => {
    const repo = createMemoryRepository()
    expect(await repo.record(outcome())).toEqual({ status: 'saved' })
    expect(await repo.record(outcome())).toEqual({ status: 'duplicate' })
    const snapshot = await repo.load()
    expect(snapshot.activity).toHaveLength(1)
    expect(snapshot.progress['white:italian']?.status).toBe('mastered')
    snapshot.activity.length = 0
    expect((await repo.load()).activity).toHaveLength(1)
  })
  it('rejects invalid numbers and unsupported settings without changing state', async () => {
    const repo = createMemoryRepository()
    expect((await repo.record(outcome({ at: Infinity }))).status).toBe('failed')
    expect(
      (await repo.updateSettings({ ...DEFAULT_SETTINGS, repetitions: 0 }))
        .status,
    ).toBe('failed')
    expect((await repo.load()).activity).toHaveLength(0)
  })
  it('reports malformed input as a failed save rather than throwing', async () => {
    const repo = createMemoryRepository()
    expect(
      (await repo.record(undefined as unknown as LearningOutcome)).status,
    ).toBe('failed')
  })
  it('rejects unknown nested fields instead of persisting unvalidated state', async () => {
    const repo = createMemoryRepository()
    const malformed = { ...DEFAULT_SETTINGS, obsolete: { bad: NaN } }
    expect((await repo.updateSettings(malformed)).status).toBe('failed')
  })
  it('keeps skipping and unfinished repetitions separate from mastery and tracks colors separately', async () => {
    const repo = createMemoryRepository()
    await repo.record(outcome({ id: 'skip', grade: 'skipped' }))
    expect((await repo.load()).progress['white:italian']?.status).toBe(
      'practicing',
    )
    expect((await repo.load()).memories).toEqual({})
    await repo.record(
      outcome({ id: 'unfinished', completed: false, cleanRepetitions: 5 }),
    )
    expect((await repo.load()).progress['white:italian']?.status).toBe(
      'practicing',
    )
    await repo.record(outcome({ id: 'finished', side: 'black' }))
    expect((await repo.load()).progress['black:italian']?.status).toBe(
      'mastered',
    )
    expect((await repo.load()).progress['white:italian']?.status).toBe(
      'practicing',
    )
  })
  it('keeps earned mastery when a later practice needs help and records response assistance', async () => {
    const repo = createMemoryRepository()
    await repo.record(outcome())
    await repo.record(
      outcome({
        id: 'retry',
        grade: 'hinted',
        cleanRepetitions: 0,
        mistakes: 2,
      }),
    )
    const snapshot = await repo.load()
    expect(snapshot.progress['white:italian']?.status).toBe('mastered')
    expect(
      snapshot.memories[responseKey('italian', 'white', 'start', 'e4')],
    ).toMatchObject({ attempts: 2, mistakes: 2, assisted: 1, dueAt: 86401000 })
  })
  it('validates saved games, preserves training phase, and lets callers clear a session', async () => {
    const repo = createMemoryRepository()
    expect(
      (await repo.saveSession(session({ moves: ['e4', 'e4'] }))).status,
    ).toBe('failed')
    expect(
      await repo.saveSession(
        session({ phase: 'recall', repetitionAssisted: true }),
      ),
    ).toEqual({ status: 'saved' })
    expect((await repo.load()).session).toMatchObject({
      phase: 'recall',
      repetitionAssisted: true,
    })
    await repo.saveSession(null)
    expect((await repo.load()).session).toBeNull()
  })
  it('notifies only completed changes and respects unsubscribe and close', async () => {
    const repo = createMemoryRepository()
    let changes = 0
    const unsubscribe = repo.subscribe(() => {
      changes++
    })
    await repo.record(outcome())
    await repo.record(outcome())
    await repo.updateSettings({ ...DEFAULT_SETTINGS, repetitions: 0 })
    expect(changes).toBe(1)
    unsubscribe()
    await repo.updateSettings({ ...DEFAULT_SETTINGS, repetitions: 3 })
    expect(changes).toBe(1)
    repo.close()
    expect((await repo.record(outcome({ id: 'closed' }))).status).toBe('failed')
    await expect(repo.load()).rejects.toThrow('closed')
  })
  it('records round summaries without counting the final response twice and masters clean sparring', async () => {
    const repo = createMemoryRepository()
    await repo.record(outcome({ completed: false, cleanRepetitions: 0 }))
    expect(
      (await repo.record(outcome({ id: 'round', kind: 'round' }))).status,
    ).toBe('saved')
    expect(
      (await repo.load()).memories[
        responseKey('italian', 'white', 'start', 'e4')
      ]?.attempts,
    ).toBe(1)
    await repo.record(
      outcome({
        id: 'sparring-round',
        lineId: 'other-line',
        kind: 'round',
        mode: 'sparring',
      }),
    )
    expect((await repo.load()).progress['white:other-line']?.status).toBe(
      'mastered',
    )
  })
  it('rejects sparse move arrays instead of treating missing entries as a valid game', async () => {
    const repo = createMemoryRepository()
    const moves = Array<string>(2)
    moves[1] = 'e4'
    expect((await repo.saveSession(session({ moves }))).status).toBe('failed')
  })
  it('uses the guided round target captured at start and does not award new mastery for review', async () => {
    const repo = createMemoryRepository()
    expect(
      (
        await repo.record(
          outcome({
            requiredRepetitions: 2,
            cleanRepetitions: 2,
            kind: 'round',
          }),
        )
      ).status,
    ).toBe('saved')
    expect((await repo.load()).progress['white:italian']?.status).toBe(
      'mastered',
    )
    await repo.record(
      outcome({
        id: 'review',
        mode: 'review',
        lineId: 'unlearned',
        requiredRepetitions: 1,
        cleanRepetitions: 5,
      }),
    )
    expect((await repo.load()).progress['white:unlearned']?.status).toBe(
      'practicing',
    )
    expect(
      (
        await repo.record(
          outcome({ id: 'invalid-target', requiredRepetitions: 0 }),
        )
      ).status,
    ).toBe('failed')
  })
  it('exports session validation and verifies the optional pending reset flag', async () => {
    const repo = createMemoryRepository()
    const saved = session({ pendingReset: true })
    expect(isSavedSession(saved)).toBe(true)
    expect(isSavedSession(null)).toBe(false)
    expect(isSavedSession({ ...saved, phase: 'unknown' })).toBe(false)
    expect(isSavedSession({ ...saved, pendingReset: 'yes' })).toBe(false)
    expect((await repo.saveSession(saved)).status).toBe('saved')
  })
})
