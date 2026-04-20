import { describe, expect, it } from 'vitest'
import { createTrainingSession } from '~/composables/training-session'
import { initialProgress } from '~/domain/progress'
import { TARGET_REPS } from '~/domain/session'
import type { Line, LineProgress } from '~/domain/types'

const italian: Line = {
  id: 'C50-italian-game',
  eco: 'C50',
  fullName: 'Italian Game',
  pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4',
  sanMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
  userSide: 'white',
}

interface FakeRepo {
  getLine: (id: string) => Promise<LineProgress>
  saveLine: (p: LineProgress) => Promise<void>
  saved: LineProgress[]
}

const fakeRepo = (): FakeRepo => {
  const saved: LineProgress[] = []
  return {
    saved,
    getLine: async (id) => initialProgress(id),
    saveLine: async (p) => {
      saved.push({ ...p })
    },
  } satisfies FakeRepo
}

describe('createTrainingSession', () => {
  it('drives the line from start to mastered', async () => {
    const repo = fakeRepo()
    const now = () => 1_700_000_000_000
    const session = createTrainingSession({ line: italian, repo, now })

    while (session.state.value.phase !== 'done') {
      const expected = session.state.value.expectedSan!
      await session.submit(expected)
    }

    expect(session.state.value.repsDone).toBe(TARGET_REPS)
    expect(session.state.value.phase).toBe('done')

    const final = repo.saved.at(-1)!
    expect(final.status).toBe('mastered')
    expect(final.lineId).toBe(italian.id)
    expect(final.lastPracticedAt).toBe(now())
  })

  it('exposes wrong-move feedback without losing progress', async () => {
    const repo = fakeRepo()
    const session = createTrainingSession({
      line: italian,
      repo,
      now: () => 0,
    })

    await session.submit('e4')
    await session.submit('e4')

    const before = session.state.value.expectedMoveIndex
    const result = await session.submit('h6')
    expect(result.result).toBe('wrong')
    expect(session.state.value.expectedMoveIndex).toBe(before)
    expect(session.lastFeedback.value?.kind).toBe('wrong')
  })
})
