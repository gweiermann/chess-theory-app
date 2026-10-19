import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBoard } from '../../app/modules/board'
import { createTraining } from '../../app/modules/training'
import { createMemoryRepository } from '../../app/modules/learning'
import { DEFAULT_SETTINGS } from '../../app/modules/shared'
import type { Family } from '../../app/modules/shared'
import type { MistakeBook, MistakeBranch } from '../../app/modules/mistakes'

const history = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']
const line = {
  id: 'main',
  familyId: 'italian',
  topicId: 'e4',
  name: 'Italian Game',
  eco: 'C50',
  suggestedSide: 'white' as const,
  moves: [...history, 'Bc5', 'c3'],
}
const family: Family = {
  summary: { id: 'italian', name: 'Italian Game', topicId: 'e4', lineCount: 2 },
  lines: [line, { ...line, id: 'other', moves: [...history, 'Nf6', 'd3'] }],
}
const branch: MistakeBranch = {
  id: 'fault',
  history,
  mistake: 'Nd4',
  lossCp: 200,
  advantageCp: 150,
  paths: [{ moves: ['Nxe5', 'd6', 'Nf3'], advantageCp: 140 }],
}
const book: MistakeBook = {
  revision: 'analysis',
  at: (moves, side) =>
    side === 'white' && JSON.stringify(moves) === JSON.stringify(history)
      ? [branch]
      : [],
  get: (id) => (id === branch.id ? branch : undefined),
}
const create = (repository = createMemoryRepository(), mistakeBook = book) => {
  const board = createBoard()
  const training = createTraining({
    board,
    repository,
    family,
    settings: { ...DEFAULT_SETTINGS },
    datasetRevision: 'opening',
    mistakeBook,
    opponentDelayMs: 100,
    random: () => 0,
  })
  return { board, training, repository }
}
afterEach(() => vi.useRealTimers())
describe('experimental mistake training', () => {
  it('extends a terminal theory position and clears an unseen theory premove without penalty', async () => {
    vi.useFakeTimers()
    const ending = {
      ...branch,
      id: 'ending',
      history: line.moves,
      paths: [{ moves: ['cxd4'], advantageCp: 150 }],
    }
    const endingBook: MistakeBook = {
      revision: 'ending-analysis',
      at: (moves, side) =>
        side === 'white' &&
        JSON.stringify(moves) === JSON.stringify(ending.history)
          ? [ending]
          : [],
      get: () => ending,
    }
    const { training } = create(undefined, endingBook)
    training.start('main', 'mistakes', 'white')
    await vi.advanceTimersByTimeAsync(100)
    training.submit('c3')
    expect(training.snapshot().status).toBe('opponent')
    await vi.advanceTimersByTimeAsync(100)
    expect(training.snapshot().phase).toBe('punish')
    training.submit('cxd4')
    expect(training.snapshot().status).toBe('complete')
    training.dispose()
    const fresh = create()
    fresh.training.start('main', 'mistakes', 'white')
    fresh.training.submit({ from: 'c2', to: 'c3' })
    await vi.advanceTimersByTimeAsync(100)
    expect(fresh.board.snapshot().premoveQueue).toEqual([])
    expect(fresh.training.snapshot().mistakes).toBe(0)
    expect(fresh.training.snapshot().message).toBe('punish')
    fresh.training.dispose()
  })
  it('persists an observed slip and defers it on the next exploration round', async () => {
    vi.useFakeTimers()
    const first = create()
    first.training.start('main', 'mistakes', 'white')
    await vi.advanceTimersByTimeAsync(100)
    first.training.submit('Nxe5')
    await vi.advanceTimersByTimeAsync(100)
    first.training.submit('Nf3')
    await first.training.retrySaving()
    first.training.dispose()
    const learning = await first.repository.load()
    const board = createBoard()
    const next = createTraining({
      board,
      repository: first.repository,
      learning,
      family,
      settings: { ...DEFAULT_SETTINGS },
      datasetRevision: 'opening',
      mistakeBook: book,
      opponentDelayMs: 100,
      random: () => 0,
    })
    next.start('main', 'mistakes', 'white')
    await vi.advanceTimersByTimeAsync(100)
    expect(next.snapshot().phase).toBe('sparring')
    expect(board.snapshot().moves.at(-1)).toBe('Bc5')
    next.dispose()
  })
  it('recognizes a White slip and trains Black against the prepared defense', async () => {
    vi.useFakeTimers()
    const blackBranch = {
      ...branch,
      history: [...history, 'Bc5'],
      mistake: 'b4',
      paths: [{ moves: ['Bxb4', 'c3', 'Bc5'], advantageCp: 150 }],
    }
    const blackBook: MistakeBook = {
      revision: 'black-analysis',
      at: (moves, side) =>
        side === 'black' &&
        JSON.stringify(moves) === JSON.stringify(blackBranch.history)
          ? [blackBranch]
          : [],
      get: () => blackBranch,
    }
    const { training } = create(undefined, blackBook)
    training.start('main', 'mistakes', 'black')
    training.submit('Bc5')
    await vi.advanceTimersByTimeAsync(100)
    expect(training.snapshot().phase).toBe('punish')
    training.submit('Bxb4')
    await vi.advanceTimersByTimeAsync(100)
    training.submit('Bc5')
    expect(training.snapshot().message).toBe('advantage')
    training.dispose()
  })
  it('continues beyond theory through verified replies, rejects other moves and completes without mastery', async () => {
    vi.useFakeTimers()
    const { board, training, repository } = create()
    training.start('main', 'mistakes', 'white')
    await vi.advanceTimersByTimeAsync(100)
    expect(board.snapshot().moves).toEqual([...history, 'Nd4'])
    expect(training.snapshot().phase).toBe('punish')
    training.submit('d3')
    training.submit('d3')
    expect(board.snapshot().moves).toEqual([...history, 'Nd4'])
    expect(board.snapshot().arrows[0]?.purpose).toBe('solution')
    training.submit('Nxe5')
    await vi.advanceTimersByTimeAsync(100)
    expect(training.snapshot().available).toEqual(['Nf3'])
    training.submit('Nf3')
    expect(training.snapshot().message).toBe('advantage')
    await training.retrySaving()
    expect((await repository.load()).progress['white:main']?.status).toBe(
      'practicing',
    )
    training.dispose()
  })
  it('restores a challenge only against the same analysis revision and legal continuation', async () => {
    vi.useFakeTimers()
    const first = create()
    first.training.start('main', 'mistakes', 'white')
    await vi.advanceTimersByTimeAsync(100)
    first.training.submit('Nxe5')
    await first.training.retrySaving()
    const saved = (await first.repository.load()).session!
    first.training.dispose()
    const restored = create(first.repository)
    restored.training.start('main', 'mistakes', 'white', saved)
    expect(restored.training.snapshot().phase).toBe('punish')
    await vi.advanceTimersByTimeAsync(100)
    expect(restored.board.snapshot().moves.at(-1)).toBe('d6')
    restored.training.dispose()
    const stale = create(first.repository, { ...book, revision: 'changed' })
    stale.training.start('main', 'mistakes', 'white', saved)
    expect(stale.board.snapshot().moves).toEqual(history)
    expect(stale.training.snapshot().message).toBe('stale-session')
    stale.training.dispose()
  })
  it('leaves ordinary free play unchanged and cancels a scheduled mistake on restart/history', async () => {
    vi.useFakeTimers()
    const { board, training } = create()
    training.start('main', 'sparring', 'white')
    await vi.advanceTimersByTimeAsync(100)
    expect(board.snapshot().moves.at(-1)).toBe('Bc5')
    training.start('main', 'mistakes', 'white')
    training.viewHistory(0)
    await vi.advanceTimersByTimeAsync(100)
    expect(board.snapshot().moves).toEqual(history)
    training.viewHistory(null)
    training.restart()
    await vi.advanceTimersByTimeAsync(100)
    expect(board.snapshot().moves).toEqual([...history, 'Nd4'])
    training.dispose()
  })
})
