import { ref, type Ref } from 'vue'
import {
  startSession,
  submitMove,
  type SessionState,
  type SubmitResult,
} from '~/domain/session'
import {
  initialProgress,
  markInProgress,
  markMastered,
} from '~/domain/progress'
import type { ActivityEvent } from '~/domain/activity'
import type { Line, LineProgress } from '~/domain/types'

export interface TrainingFeedback {
  kind: 'correct' | 'wrong'
  expected?: string
  played: string
}

export interface TrainingProgressRepository {
  getLine(id: string): Promise<LineProgress>
  saveLine(progress: LineProgress): Promise<void>
}

export interface TrainingActivityRecorder {
  topicId: string
  record(event: ActivityEvent): Promise<void> | void
}

export interface TrainingSessionOptions {
  line: Line
  repo: TrainingProgressRepository
  now?: () => number
  activityRecorder?: TrainingActivityRecorder
  /**
   * Number of half-moves that are already mastered through a parent line and
   * should be auto-played as setup. See {@link startSession} for how this
   * influences the phase timeline.
   */
  prefixPlies?: number
}

export interface TrainingSession {
  state: Ref<SessionState>
  lastFeedback: Ref<TrainingFeedback | null>
  submit(san: string): Promise<SubmitResult>
  reset(): void
}

const noopRecord = async (): Promise<void> => {}

export const createTrainingSession = ({
  line,
  repo,
  now = () => Date.now(),
  activityRecorder,
  prefixPlies = 0,
}: TrainingSessionOptions): TrainingSession => {
  const state = ref<SessionState>(startSession(line, prefixPlies))
  const lastFeedback = ref<TrainingFeedback | null>(null)
  const topicId = activityRecorder?.topicId ?? ''
  const recordFn = activityRecorder?.record ?? noopRecord

  // Mistake counter scoped to the current rep (resets each time the engine
  // starts a fresh attempt at idx 0 in repeating phase or finishes a step).
  let mistakesThisRep = 0
  // Timestamp of the last "fresh start" of a rep. This anchor lets us compute
  // durationMs for each rep_completed event we emit.
  let repStartedAt = now()
  // Index of the rep currently being played, 1-based.
  let nextRepIndex = 1

  const record = (event: ActivityEvent): void => {
    void recordFn(event)
  }

  // Emit session_started immediately so the activity log shows a session even
  // if the user closes the app before completing a rep. Reuse the same
  // timestamp as `repStartedAt` so callers passing a deterministic clock see
  // matching values.
  record({ topicId, lineId: line.id, type: 'session_started', at: repStartedAt })

  const persist = async (next: SessionState): Promise<void> => {
    const current = await repo.getLine(line.id)
    const base = current ?? initialProgress(line.id)
    const updated =
      next.phase === 'done'
        ? markMastered(base, now())
        : markInProgress(base, next.repsDone, now())
    await repo.saveLine(updated)
  }

  const submit = async (san: string): Promise<SubmitResult> => {
    const previous = state.value
    const result = submitMove(previous, san)
    state.value = result.state

    if (result.result === 'wrong') {
      lastFeedback.value = {
        kind: 'wrong',
        expected: result.expected,
        played: san,
      }
      mistakesThisRep += 1
      record({
        topicId,
        lineId: line.id,
        type: 'mistake',
        at: now(),
        expected: result.expected,
        played: san,
      })
      return result
    }

    lastFeedback.value = { kind: 'correct', played: san }

    const next = result.state

    const masteredJustNow =
      previous.phase !== 'done' && next.phase === 'done'

    // Detect rep boundaries: a rep completes either when we stay in repeating
    // and `repsDone` ticks up, or when the final rep transitions us to `done`.
    const repeatedRepFinished =
      previous.phase === 'repeating'
      && (next.phase === 'repeating' || next.phase === 'done')
      && next.repsDone > previous.repsDone

    const enteredRepeating =
      previous.phase === 'building' && next.phase === 'repeating'

    if (repeatedRepFinished) {
      const at = now()
      record({
        topicId,
        lineId: line.id,
        type: 'rep_completed',
        at,
        durationMs: at - repStartedAt,
        mistakeCount: mistakesThisRep,
        repIndex: nextRepIndex,
      })
      nextRepIndex += 1
      mistakesThisRep = 0
      repStartedAt = at
    } else if (enteredRepeating) {
      // Building completed; consider the building drill itself a rep so the
      // first review carries timing + mistake info, then start the rep clock.
      const at = now()
      record({
        topicId,
        lineId: line.id,
        type: 'rep_completed',
        at,
        durationMs: at - repStartedAt,
        mistakeCount: mistakesThisRep,
        repIndex: nextRepIndex,
      })
      nextRepIndex += 1
      mistakesThisRep = 0
      repStartedAt = at
    }

    if (masteredJustNow) {
      record({ topicId, lineId: line.id, type: 'line_mastered', at: now() })
    }

    await persist(result.state)
    return result
  }

  const reset = (): void => {
    state.value = startSession(line, prefixPlies)
    lastFeedback.value = null
    mistakesThisRep = 0
    nextRepIndex = 1
    repStartedAt = now()
    record({ topicId, lineId: line.id, type: 'session_started', at: now() })
  }

  return { state, lastFeedback, submit, reset }
}
