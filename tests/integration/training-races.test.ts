import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createTraining } from '../../app/modules/training'
import { createBoard } from '../../app/modules/board'
import { createMemoryRepository } from '../../app/modules/learning'
import { DEFAULT_SETTINGS, progressKey } from '../../app/modules/shared'
import type { Family, SavedSession } from '../../app/modules/shared'

const family: Family = {
  summary: { id: 'italian', name: 'Italian', topicId: 'e4', lineCount: 1 },
  lines: [
    {
      id: 'base',
      familyId: 'italian',
      topicId: 'e4',
      eco: 'C50',
      name: 'Italian',
      suggestedSide: 'white',
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    },
  ],
}
function fixture() {
  const board = createBoard()
  const repository = createMemoryRepository()
  const controller = createTraining({
    board,
    repository,
    family,
    settings: { ...DEFAULT_SETTINGS, autoSetup: false, repetitions: 2 },
    datasetRevision: 'fixture-v1',
    opponentDelayMs: 100,
    resetDelayMs: 200,
  })
  return { board, repository, controller }
}
async function round(controller: ReturnType<typeof createTraining>) {
  controller.submit('e4')
  await vi.advanceTimersByTimeAsync(100)
  controller.submit('Nf3')
  await vi.advanceTimersByTimeAsync(100)
  controller.submit('Bc4')
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('cancels an opponent reply when restarting before its deadline', async () => {
  const { board, controller } = fixture()
  controller.start('base', 'review', 'white')
  controller.submit('e4')
  await vi.advanceTimersByTimeAsync(40)
  controller.restart()
  await vi.advanceTimersByTimeAsync(500)
  expect(board.snapshot().moves).toEqual([])
  expect(controller.snapshot().expectedSan).toBe('e4')
  controller.dispose()
})

it('disposal prevents pending replies and subsequent start commands', async () => {
  const { board, controller } = fixture()
  controller.start('base', 'review', 'white')
  controller.submit('e4')
  controller.dispose()
  const revision = board.snapshot().revision
  await vi.advanceTimersByTimeAsync(500)
  expect(board.snapshot().moves).toEqual(['e4'])
  controller.start('base', 'review', 'black')
  expect(board.snapshot().revision).toBe(revision)
})

it('switching sides cancels work belonging to the prior round', async () => {
  const { board, controller } = fixture()
  controller.start('base', 'review', 'black')
  await vi.advanceTimersByTimeAsync(40)
  controller.start('base', 'review', 'white')
  await vi.advanceTimersByTimeAsync(200)
  expect(board.snapshot().moves).toEqual([])
  expect(board.snapshot().playerSide).toBe('white')
  expect(controller.snapshot().status).toBe('player')
  controller.dispose()
})

it('history inspection pauses an opponent reply and returning live schedules exactly one', async () => {
  const { board, controller } = fixture()
  controller.start('base', 'review', 'white')
  controller.submit('e4')
  controller.viewHistory(0)
  await vi.advanceTimersByTimeAsync(500)
  expect(board.snapshot().moves).toEqual(['e4'])
  expect(board.snapshot().viewedPly).toBe(0)
  controller.viewHistory(null)
  await vi.advanceTimersByTimeAsync(100)
  expect(board.snapshot().moves).toEqual(['e4', 'e5'])
  controller.dispose()
})

it('consumes a valid premove once after the opponent reply', async () => {
  const { board, repository, controller } = fixture()
  controller.start('base', 'review', 'white')
  controller.submit('e4')
  controller.submit({ from: 'g1', to: 'f3' })
  await vi.advanceTimersByTimeAsync(100)
  expect(board.snapshot().moves).toEqual(['e4', 'e5', 'Nf3'])
  expect(board.snapshot().premove).toBeNull()
  await controller.retrySaving()
  const learning = await repository.load()
  expect(
    learning.activity.filter(
      (event) => event.kind === 'response' && event.move === 'Nf3',
    ),
  ).toHaveLength(1)
  controller.dispose()
})

it('demonstrates once then requires two independent clean rounds for mastery', async () => {
  const { repository, controller } = fixture()
  controller.start('base', 'guided', 'white')
  await round(controller)
  expect(controller.snapshot().cleanRepetitions).toBe(0)
  expect(controller.snapshot().phase).toBe('recall')
  await vi.advanceTimersByTimeAsync(200)
  await round(controller)
  expect(controller.snapshot().cleanRepetitions).toBe(1)
  await vi.advanceTimersByTimeAsync(200)
  await round(controller)
  expect(controller.snapshot().phase).toBe('complete')
  expect(controller.snapshot().cleanRepetitions).toBe(2)
  await controller.retrySaving()
  const learning = await repository.load()
  expect(learning.progress[progressKey('base', 'white')]?.status).toBe(
    'mastered',
  )
  expect(
    learning.progress[progressKey('base', 'white')]?.cleanRepetitions,
  ).toBe(2)
  expect(learning.session).toBeNull()
  controller.dispose()
})

it('retry and solution assistance prevent a clean repetition', async () => {
  const { repository, controller } = fixture()
  controller.start('base', 'review', 'white')
  controller.submit('d4')
  controller.submit('e4')
  await vi.advanceTimersByTimeAsync(100)
  controller.requestHelp()
  controller.submit('Nf3')
  await vi.advanceTimersByTimeAsync(100)
  controller.submit('Bc4')
  expect(controller.snapshot().cleanRepetitions).toBe(0)
  expect(controller.snapshot().phase).toBe('recall')
  await controller.retrySaving()
  expect(
    (await repository.load()).progress[progressKey('base', 'white')]?.status,
  ).toBe('practicing')
  controller.dispose()
})

it('duplicate submits during opponent turn cannot duplicate a recalled response', async () => {
  const { board, repository, controller } = fixture()
  controller.start('base', 'review', 'white')
  controller.submit('e4')
  controller.submit('e4')
  await controller.retrySaving()
  expect(board.snapshot().moves).toEqual(['e4'])
  expect(
    (await repository.load()).activity.filter(
      (event) => event.kind === 'response',
    ),
  ).toHaveLength(1)
  controller.dispose()
})

it('resumes a saved live position and rejects a changed opening dataset', async () => {
  const first = fixture()
  first.controller.start('base', 'review', 'white')
  first.controller.submit('e4')
  await first.controller.retrySaving()
  const saved = (await first.repository.load()).session!
  first.controller.dispose()
  const resumed = fixture()
  resumed.controller.start('base', 'review', 'white', saved)
  await vi.advanceTimersByTimeAsync(100)
  expect(resumed.board.snapshot().moves).toEqual(['e4', 'e5'])
  expect(resumed.controller.snapshot().expectedSan).toBe('Nf3')
  resumed.controller.dispose()
  const stale = fixture()
  stale.controller.start('base', 'review', 'white', {
    ...saved,
    datasetRevision: 'other',
  })
  expect(stale.board.snapshot().moves).toEqual([])
  expect(stale.controller.snapshot().message).toBe('stale-session')
  stale.controller.dispose()
})

it('rejects malformed saved counters and phases instead of corrupting the round', async () => {
  const first = fixture()
  first.controller.start('base', 'review', 'white')
  await first.controller.retrySaving()
  const saved = (await first.repository.load()).session!
  first.controller.dispose()
  const resumed = fixture()
  resumed.controller.start('base', 'review', 'white', {
    ...saved,
    cleanRepetitions: -100,
    phase: 'complete',
  } as unknown as SavedSession)
  expect(resumed.controller.snapshot().phase).toBe('recall')
  expect(resumed.controller.snapshot().cleanRepetitions).toBe(0)
  expect(resumed.controller.snapshot().message).toBe('stale-session')
  resumed.controller.dispose()
})

it('history during the between-round pause cannot count an unplayed repetition', async () => {
  const { board, controller } = fixture()
  controller.start('base', 'guided', 'white')
  await round(controller)
  controller.viewHistory(0)
  await vi.advanceTimersByTimeAsync(500)
  controller.viewHistory(null)
  expect(controller.snapshot().cleanRepetitions).toBe(0)
  await vi.advanceTimersByTimeAsync(200)
  expect(board.snapshot().moves).toEqual([])
  controller.dispose()
})

it('history after a clean round cannot grant the next unplayed repetition', async () => {
  const { controller, repository } = fixture()
  controller.start('base', 'guided', 'white')
  await round(controller)
  await vi.advanceTimersByTimeAsync(200)
  await round(controller)
  expect(controller.snapshot().cleanRepetitions).toBe(1)
  controller.viewHistory(0)
  await vi.advanceTimersByTimeAsync(500)
  controller.viewHistory(null)
  expect(controller.snapshot().cleanRepetitions).toBe(1)
  expect(controller.snapshot().phase).toBe('recall')
  await controller.retrySaving()
  expect(
    (await repository.load()).activity.filter(
      (event) => event.kind === 'round',
    ),
  ).toHaveLength(2)
  controller.dispose()
})

it('uses the started learner side rather than the initial setting for learned repertoire', async () => {
  const board = createBoard()
  const repository = createMemoryRepository()
  const learning = await repository.load()
  const branches: Family = {
    ...family,
    summary: { ...family.summary, lineCount: 2 },
    lines: [
      ...family.lines,
      { ...family.lines[0]!, id: 'other', moves: ['e4', 'c5', 'Nf3'] },
    ],
  }
  learning.progress['white:base'] = {
    lineId: 'base',
    side: 'white',
    status: 'mastered',
    cleanRepetitions: 5,
    lastPracticedAt: 0,
  }
  learning.progress['black:other'] = {
    lineId: 'other',
    side: 'black',
    status: 'mastered',
    cleanRepetitions: 5,
    lastPracticedAt: 0,
  }
  const controller = createTraining({
    board,
    repository,
    learning,
    family: branches,
    settings: { ...DEFAULT_SETTINGS, autoSetup: false },
    datasetRevision: 'fixture-v1',
    opponentDelayMs: 100,
  })
  controller.start('other', 'sparring', 'black')
  await vi.advanceTimersByTimeAsync(100)
  expect(controller.snapshot().available).toEqual(['c5'])
  controller.submit('c5')
  expect(board.snapshot().moves).toEqual(['e4', 'c5'])
  controller.dispose()
})

it('disposed controllers cannot record skip activity or alter history', async () => {
  const { controller, board, repository } = fixture()
  controller.start('base', 'review', 'white')
  controller.submit('e4')
  controller.dispose()
  controller.skip()
  controller.viewHistory(0)
  await controller.retrySaving()
  expect(
    (await repository.load()).activity.some(
      (event) => event.grade === 'skipped',
    ),
  ).toBe(false)
  expect(board.snapshot().viewedPly).toBeNull()
})
it('clears an impossible queued move and reports that it could not be played', async () => {
  const { board, controller } = fixture()
  controller.start('base', 'review', 'white')
  controller.submit('e4')
  controller.submit({ from: 'a1', to: 'a8' })
  await vi.advanceTimersByTimeAsync(100)
  expect(board.snapshot().moves).toEqual(['e4', 'e5'])
  expect(board.snapshot().premove).toBeNull()
  expect(controller.snapshot().message).toBe('premove-cancelled')
  controller.dispose()
})

it('executes two queued opening responses in FIFO order exactly once', async () => {
  const { controller, board, repository } = fixture()
  controller.start('base', 'review', 'white')
  controller.submit('e4')
  controller.submit({ from: 'g1', to: 'f3' })
  controller.submit({ from: 'f1', to: 'c4' })
  await vi.advanceTimersByTimeAsync(100)
  expect(board.snapshot().moves).toEqual(['e4', 'e5', 'Nf3'])
  expect(board.snapshot().premoveQueue).toEqual([{ from: 'f1', to: 'c4' }])
  await vi.advanceTimersByTimeAsync(100)
  expect(board.snapshot().moves).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])
  expect(board.snapshot().premoveQueue).toEqual([])
  await controller.retrySaving()
  const events = (await repository.load()).activity.filter(
    (event) => event.kind === 'response',
  )
  expect(events.map((event) => event.move)).toEqual(['e4', 'Nf3', 'Bc4'])
  controller.dispose()
})
