import { afterEach, expect, it, vi } from 'vitest'
import { Chess } from 'chess.js'
import { createBoard } from '../../app/modules/board'
import { createTraining } from '../../app/modules/training'
import { createMemoryRepository } from '../../app/modules/learning'
import { chooseLesson } from '../../app/modules/selection'
import { DEFAULT_SETTINGS, responseKey } from '../../app/modules/shared'
import type { Family } from '../../app/modules/shared'

const root = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']
const family: Family = {
  summary: { id: 'italian', name: 'Italian', topicId: 'e4', lineCount: 2 },
  lines: [
    {
      id: 'long',
      familyId: 'italian',
      topicId: 'e4',
      eco: 'C50',
      name: 'Long',
      suggestedSide: 'white',
      moves: [...root, 'Bc5', 'c3', 'Nf6', 'd4'],
    },
    {
      id: 'short',
      familyId: 'italian',
      topicId: 'e4',
      eco: 'C50',
      name: 'Short',
      suggestedSide: 'white',
      moves: [...root, 'Nf6', 'd3'],
    },
  ],
}
afterEach(() => vi.useRealTimers())

it('remembers free play across controllers, learns a clean leaf and chooses unseen material next', async () => {
  vi.useFakeTimers()
  const repository = createMemoryRepository()
  const settings = { ...DEFAULT_SETTINGS, autoSetup: true }
  const board = createBoard()
  const training = createTraining({
    board,
    repository,
    family,
    settings,
    learning: await repository.load(),
    datasetRevision: 'test',
    opponentDelayMs: 100,
  })
  training.start('long', 'sparring', 'white')
  await vi.advanceTimersByTimeAsync(100)
  expect(board.snapshot().moves).toEqual([...root, 'Bc5'])
  training.submit('c3')
  await vi.advanceTimersByTimeAsync(100)
  training.submit('d4')
  await training.retrySaving()
  expect(training.snapshot()).toMatchObject({
    phase: 'complete',
    assisted: 0,
    cleanRepetitions: 1,
  })
  training.dispose()
  const learning = await repository.load()
  expect(learning.progress['white:long']?.status).toBe('mastered')
  expect(learning.activity.some((event) => event.kind === 'exposure')).toBe(
    false,
  )
  const game = new Chess()
  for (const san of root) game.move(san)
  const key = responseKey(
    'italian',
    'white',
    game.fen().split(' ').slice(0, 4).join(' '),
    'Bc5',
  )
  expect(learning.memories[key]).toMatchObject({
    attempts: 1,
    assisted: 0,
    mistakes: 0,
  })
  expect(
    chooseLesson({
      lines: family.lines,
      ...learning,
      side: 'white',
      mode: 'sparring',
      now: Date.now(),
      random: () => 0,
    })?.line.id,
  ).toBe('short')
  const restored = createTraining({
    board: createBoard(),
    repository,
    family,
    settings,
    learning,
    datasetRevision: 'test',
    opponentDelayMs: 100,
  })
  restored.start('long', 'sparring', 'white')
  await vi.advanceTimersByTimeAsync(100)
  expect(restored.snapshot()).toMatchObject({ newMaterial: false })
  restored.dispose()
})

it('keeps helped unfamiliar material familiar after a reload without awarding mastery', async () => {
  vi.useFakeTimers()
  const repository = createMemoryRepository()
  const options = {
    repository,
    family,
    settings: { ...DEFAULT_SETTINGS },
    datasetRevision: 'test',
    opponentDelayMs: 100,
  }
  const first = createTraining({ ...options, board: createBoard() })
  first.start('short', 'sparring', 'white')
  await vi.advanceTimersByTimeAsync(100)
  first.requestHelp()
  first.submit('d3')
  await first.retrySaving()
  first.dispose()
  const learning = await repository.load()
  expect(learning.progress['white:short']?.status).toBe('practicing')
  const again = createTraining({ ...options, board: createBoard(), learning })
  again.start('short', 'sparring', 'white')
  await vi.advanceTimersByTimeAsync(100)
  expect(again.snapshot().newMaterial).toBe(false)
  again.dispose()
})
