import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTraining } from '../../app/modules/training'
import { createBoard } from '../../app/modules/board'
import { createMemoryRepository } from '../../app/modules/learning'
import { DEFAULT_SETTINGS } from '../../app/modules/shared'
import type { Family } from '../../app/modules/shared'
import { responseKey } from '../../app/modules/shared'
import type { LearnerRepository } from '../../app/modules/learning'
const family: Family = {
  summary: { id: 'italian', name: 'Italian Game', topicId: 'e4', lineCount: 1 },
  lines: [
    {
      id: 'base',
      familyId: 'italian',
      topicId: 'e4',
      eco: 'C50',
      name: 'Italian Game',
      suggestedSide: 'white',
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    },
  ],
}
afterEach(() => vi.useRealTimers())
describe('training coordinator', () => {
  it('expands a named prefix to its shortest complete lesson when starting guided learning', () => {
    const longer = {
      ...family.lines[0]!,
      id: 'long',
      moves: [...family.lines[0]!.moves, 'Bc5', 'c3'],
    }
    const controller = createTraining({
      board: createBoard(),
      repository: createMemoryRepository(),
      family: {
        ...family,
        lines: [
          ...family.lines,
          longer,
          {
            ...family.lines[0]!,
            id: 'short',
            moves: [...family.lines[0]!.moves, 'Nf6'],
          },
        ],
      },
      settings: { ...DEFAULT_SETTINGS },
      datasetRevision: 'test',
    })
    controller.start('base', 'guided', 'white')
    expect(controller.snapshot().line.id).toBe('short')
    controller.dispose()
  })
  it('continues free play beyond learned prefixes and helps with unfamiliar continuations', async () => {
    vi.useFakeTimers()
    const board = createBoard()
    const repository = createMemoryRepository()
    const learning = await repository.load()
    learning.progress['white:base'] = {
      lineId: 'base',
      side: 'white',
      status: 'mastered',
      cleanRepetitions: 5,
      lastPracticedAt: 1,
    }
    const extended = {
      ...family.lines[0]!,
      id: 'long',
      moves: [...family.lines[0]!.moves, 'Bc5', 'c3', 'Nf6', 'd4'],
    }
    const controller = createTraining({
      board,
      repository,
      learning,
      family: { ...family, lines: [...family.lines, extended] },
      settings: { ...DEFAULT_SETTINGS, autoSetup: false, allowNew: false },
      datasetRevision: 'test',
      opponentDelayMs: 100,
    })
    controller.start('base', 'sparring', 'white')
    controller.submit('e4')
    await vi.advanceTimersByTimeAsync(100)
    controller.submit('Nf3')
    await vi.advanceTimersByTimeAsync(100)
    controller.submit('Bc4')
    await vi.advanceTimersByTimeAsync(100)
    expect(board.snapshot().moves).toEqual([
      'e4',
      'e5',
      'Nf3',
      'Nc6',
      'Bc4',
      'Bc5',
    ])
    expect(controller.snapshot()).toMatchObject({
      status: 'player',
      newMaterial: true,
      expectedSan: 'c3',
    })
    controller.submit('a3')
    controller.requestHelp()
    expect(board.snapshot().arrows).toEqual([
      { from: 'c2', to: 'c3', purpose: 'solution' },
    ])
    controller.submit('c3')
    await vi.advanceTimersByTimeAsync(100)
    controller.submit('d4')
    expect(controller.snapshot().phase).toBe('complete')
    await controller.retrySaving()
    const result = await repository.load()
    expect(result.progress['white:long']?.status).not.toBe('mastered')
    expect(
      result.activity.filter((event) => event.move === 'c3')[0]?.grade,
    ).toBe('new')
    expect(controller.snapshot().mistakes).toBe(0)
    controller.dispose()
  })
  it('records skipping a round at most once', async () => {
    const repository = createMemoryRepository()
    const controller = createTraining({
      board: createBoard(),
      repository,
      family,
      settings: { ...DEFAULT_SETTINGS },
      datasetRevision: 'test',
    })
    controller.start('base', 'review', 'white')
    controller.skip()
    controller.skip()
    await controller.retrySaving()
    expect(
      (await repository.load()).activity.filter(
        (event) => event.grade === 'skipped',
      ),
    ).toHaveLength(1)
    controller.dispose()
  })
  it('orders an already in-flight session save before the newer controller saves', async () => {
    vi.useFakeTimers()
    const repository = createMemoryRepository()
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let started = false
    const delayed: LearnerRepository = {
      ...repository,
      saveSession: async (session) => {
        if (!started && session?.side === 'white') {
          started = true
          await gate
        }
        return repository.saveSession(session)
      },
    }
    const old = createTraining({
      board: createBoard(),
      repository: delayed,
      family,
      settings: { ...DEFAULT_SETTINGS },
      datasetRevision: 'test',
    })
    old.start('base', 'review', 'white')
    await vi.advanceTimersByTimeAsync(0)
    expect(started).toBe(true)
    old.dispose()
    const fresh = createTraining({
      board: createBoard(),
      repository: delayed,
      family,
      settings: { ...DEFAULT_SETTINGS },
      datasetRevision: 'test',
    })
    fresh.start('base', 'review', 'black')
    const retry = fresh.retrySaving()
    await vi.advanceTimersByTimeAsync(0)
    release()
    await retry
    await vi.advanceTimersByTimeAsync(0)
    expect((await repository.load()).session?.side).toBe('black')
    fresh.dispose()
  })
  it('coordinates accepted learner and opponent moves using the real Board module', async () => {
    vi.useFakeTimers()
    const board = createBoard()
    const controller = createTraining({
      board,
      repository: createMemoryRepository(),
      family,
      settings: { ...DEFAULT_SETTINGS },
      datasetRevision: 'test',
    })
    controller.start('base', 'guided', 'white')
    controller.submit('e4')
    await vi.advanceTimersByTimeAsync(1000)
    expect(board.snapshot().moves).toEqual(['e4', 'e5'])
    expect(controller.snapshot().expectedSan).toBe('Nf3')
    controller.dispose()
  })
  it('does not assign an earlier mistake to a later correctly recalled response', async () => {
    vi.useFakeTimers()
    const board = createBoard()
    const repository = createMemoryRepository()
    const controller = createTraining({
      board,
      repository,
      family,
      settings: { ...DEFAULT_SETTINGS },
      datasetRevision: 'test',
      opponentDelayMs: 100,
    })
    controller.start('base', 'review', 'white')
    controller.submit('a3')
    controller.submit('e4')
    await vi.advanceTimersByTimeAsync(400)
    const key = responseKey(
      'italian',
      'white',
      board.snapshot().positionKey,
      'Nf3',
    )
    controller.submit('Nf3')
    await controller.retrySaving()
    expect((await repository.load()).memories[key]?.mistakes).toBe(0)
    controller.dispose()
  })
  it('keeps the new session when writes from a disposed session finish later', async () => {
    vi.useFakeTimers()
    const repository = createMemoryRepository()
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const delayed: LearnerRepository = {
      ...repository,
      record: async (event) => {
        if (event.side === 'white') await gate
        return repository.record(event)
      },
    }
    const old = createTraining({
      board: createBoard(),
      repository: delayed,
      family,
      settings: { ...DEFAULT_SETTINGS },
      datasetRevision: 'test',
    })
    old.start('base', 'review', 'white')
    old.submit('e4')
    await vi.advanceTimersByTimeAsync(0)
    old.dispose()
    const fresh = createTraining({
      board: createBoard(),
      repository: delayed,
      family,
      settings: { ...DEFAULT_SETTINGS },
      datasetRevision: 'test',
    })
    fresh.start('base', 'review', 'black')
    await fresh.retrySaving()
    release()
    await vi.advanceTimersByTimeAsync(0)
    expect((await repository.load()).session?.side).toBe('black')
    fresh.dispose()
  })
  it('restores the round repetition target even when settings changed between sessions', async () => {
    const repository = createMemoryRepository()
    const original = createTraining({
      board: createBoard(),
      repository,
      family,
      settings: { ...DEFAULT_SETTINGS, repetitions: 2 },
      datasetRevision: 'test',
    })
    original.start('base', 'guided', 'white')
    await original.retrySaving()
    const saved = (await repository.load()).session!
    original.dispose()
    const resumed = createTraining({
      board: createBoard(),
      repository,
      family,
      settings: { ...DEFAULT_SETTINGS, repetitions: 7 },
      datasetRevision: 'test',
    })
    resumed.start('base', 'guided', 'white', saved)
    expect(resumed.snapshot().targetRepetitions).toBe(2)
    resumed.dispose()
  })
  it('does not let a save retry from a disposed controller overwrite a newer session', async () => {
    vi.useFakeTimers()
    const repository = createMemoryRepository()
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const delayed: LearnerRepository = {
      ...repository,
      record: async (event) => {
        if (event.side === 'white') await gate
        return repository.record(event)
      },
    }
    const old = createTraining({
      board: createBoard(),
      repository: delayed,
      family,
      settings: { ...DEFAULT_SETTINGS },
      datasetRevision: 'test',
    })
    old.start('base', 'review', 'white')
    old.submit('e4')
    await vi.advanceTimersByTimeAsync(0)
    const retry = old.retrySaving()
    old.dispose()
    const fresh = createTraining({
      board: createBoard(),
      repository: delayed,
      family,
      settings: { ...DEFAULT_SETTINGS },
      datasetRevision: 'test',
    })
    fresh.start('base', 'review', 'black')
    await fresh.retrySaving()
    release()
    await retry
    expect((await repository.load()).session?.side).toBe('black')
    fresh.dispose()
  })
})
it('allows time to queue a premove before the default opponent reply and executes it immediately', async () => {
  vi.useFakeTimers()
  const board = createBoard()
  const controller = createTraining({
    board,
    repository: createMemoryRepository(),
    family,
    settings: { ...DEFAULT_SETTINGS },
    datasetRevision: 'test',
  })
  controller.start('base', 'review', 'white')
  controller.submit('e4')
  await vi.advanceTimersByTimeAsync(500)
  expect(board.snapshot().moves).toEqual(['e4'])
  controller.submit({ from: 'g1', to: 'f3' })
  expect(board.snapshot().premove).toEqual({ from: 'g1', to: 'f3' })
  await vi.advanceTimersByTimeAsync(400)
  expect(board.snapshot().moves).toEqual(['e4', 'e5', 'Nf3'])
  expect(board.snapshot().premove).toBeNull()
  controller.dispose()
})
