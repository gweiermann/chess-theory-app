import { describe, expect, it, vi } from 'vitest'
import { createTrainingSession } from '~/composables/training-session'
import type { ActivityEvent } from '~/domain/activity'
import type { Line, LineProgress } from '~/domain/types'

const lineWhite: Line = {
  id: 'l',
  eco: '',
  fullName: 'tiny line',
  pgn: '',
  // 1 user move, 1 opponent move – keeps the test compact while still covering
  // the building -> repeating -> done transition.
  sanMoves: ['e4', 'e5'],
  userSide: 'white',
}

const stubProgressRepo = () => {
  const store = new Map<string, LineProgress>()
  return {
    getLine: async (id: string): Promise<LineProgress> =>
      store.get(id) ?? { lineId: id, status: 'new', reps: 0 },
    saveLine: async (p: LineProgress): Promise<void> => { store.set(p.lineId, p) },
  }
}

const collectEvents = () => {
  const events: ActivityEvent[] = []
  return {
    events,
    record: vi.fn(async (e: ActivityEvent) => { events.push(e) }),
  }
}

describe('createTrainingSession activity events', () => {
  it('does not require an activity recorder', async () => {
    const s = createTrainingSession({ line: lineWhite, repo: stubProgressRepo() })
    const r = await s.submit('e4')
    expect(r.result).toBe('correct')
  })

  it('emits a session_started event with the correct topic + line + timestamp', async () => {
    const repo = stubProgressRepo()
    const recorder = collectEvents()
    let now = 100
    createTrainingSession({
      line: lineWhite,
      repo,
      activityRecorder: { record: recorder.record, topicId: 'e4' },
      now: () => now++,
    })

    expect(recorder.events).toHaveLength(1)
    expect(recorder.events[0]).toMatchObject({
      type: 'session_started',
      topicId: 'e4',
      lineId: 'l',
      at: 100,
    })
  })

  it('records a mistake event with the expected and played SAN', async () => {
    const recorder = collectEvents()
    const s = createTrainingSession({
      line: lineWhite,
      repo: stubProgressRepo(),
      activityRecorder: { record: recorder.record, topicId: 'e4' },
      now: () => 200,
    })
    await s.submit('d4')
    const mistakes = recorder.events.filter((e) => e.type === 'mistake')
    expect(mistakes).toHaveLength(1)
    expect(mistakes[0]).toMatchObject({
      type: 'mistake',
      expected: 'e4',
      played: 'd4',
    })
  })

  it('emits a rep_completed event after every successful repetition with mistakeCount + duration', async () => {
    const recorder = collectEvents()
    let now = 1_000
    const s = createTrainingSession({
      line: lineWhite,
      repo: stubProgressRepo(),
      activityRecorder: { record: recorder.record, topicId: 'e4' },
      now: () => {
        const n = now
        now += 1_000
        return n
      },
    })

    // Building phase: drive through e4 (user), then e5 (opponent) -> repeating.
    await s.submit('e4') // user move; ends building, enters repeating phase
    await s.submit('e5') // opponent move; first rep complete

    const reps = recorder.events.filter((e) => e.type === 'rep_completed')
    expect(reps).toHaveLength(1)
    expect(reps[0]?.repIndex).toBe(1)
    expect(reps[0]?.mistakeCount).toBe(0)
    expect(typeof reps[0]?.durationMs).toBe('number')
    expect(reps[0]!.durationMs!).toBeGreaterThan(0)
  })

  it('attributes mistakes from a rep to the rep_completed event that follows them', async () => {
    const recorder = collectEvents()
    const s = createTrainingSession({
      line: lineWhite,
      repo: stubProgressRepo(),
      activityRecorder: { record: recorder.record, topicId: 'e4' },
      now: () => 0,
    })

    await s.submit('Nf3') // wrong (mistake during rep 1)
    await s.submit('d4')  // wrong again (mistake during rep 1)
    await s.submit('e4')  // correct
    await s.submit('e5')  // opponent => rep 1 complete

    const reps = recorder.events.filter((e) => e.type === 'rep_completed')
    expect(reps).toHaveLength(1)
    expect(reps[0]?.mistakeCount).toBe(2)

    // A second rep with no mistakes should report 0.
    await s.submit('e4')
    await s.submit('e5')
    const reps2 = recorder.events.filter((e) => e.type === 'rep_completed')
    expect(reps2).toHaveLength(2)
    expect(reps2[1]?.mistakeCount).toBe(0)
  })

  it('emits line_mastered when all required reps are completed', async () => {
    const recorder = collectEvents()
    const s = createTrainingSession({
      line: lineWhite,
      repo: stubProgressRepo(),
      activityRecorder: { record: recorder.record, topicId: 'e4' },
      now: () => 0,
    })

    // Drive e4/e5 once to clear the building phase, then ten more rounds to
    // satisfy TARGET_REPS in the repeating phase.
    for (let i = 0; i < 11; i += 1) {
      await s.submit('e4')
      await s.submit('e5')
    }

    const mastered = recorder.events.filter((e) => e.type === 'line_mastered')
    expect(mastered).toHaveLength(1)
    expect(mastered[0]?.lineId).toBe('l')
  })
})
