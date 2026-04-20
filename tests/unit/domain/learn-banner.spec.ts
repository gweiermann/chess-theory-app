import { describe, expect, it } from 'vitest'
import {
  MISTAKE_BANNER_TEXT,
  bannerForResetReason,
  getResetReason,
  shouldResetForTransition,
  willMoveTriggerReset,
  type PhaseMarkers,
} from '~/domain/learn-banner'
import { startSession, submitMove, TARGET_REPS } from '~/domain/session'
import type { Line } from '~/domain/types'

const markers = (overrides: Partial<PhaseMarkers> = {}): PhaseMarkers => ({
  phase: 'building',
  currentStep: 1,
  repsDone: 0,
  ...overrides,
})

describe('getResetReason', () => {
  it('returns null when the session is just advancing inside a step', () => {
    const before = markers({ currentStep: 1 })
    const after = markers({ currentStep: 1 })
    expect(getResetReason(before, after)).toBeNull()
  })

  it('returns "next-step" when moving from building step N to N+1', () => {
    const before = markers({ currentStep: 1 })
    const after = markers({ currentStep: 2 })
    expect(getResetReason(before, after)).toBe('next-step')
  })

  it('returns "to-repeating" when the phase flips from building to repeating', () => {
    const before = markers({ phase: 'building', currentStep: 3 })
    const after = markers({ phase: 'repeating', currentStep: 3, repsDone: 0 })
    expect(getResetReason(before, after)).toBe('to-repeating')
  })

  it('returns "next-rep" when a repetition has just completed', () => {
    const before = markers({ phase: 'repeating', repsDone: 2 })
    const after = markers({ phase: 'repeating', repsDone: 3 })
    expect(getResetReason(before, after)).toBe('next-rep')
  })

  it('never resets once the line is done', () => {
    const before = markers({ phase: 'repeating', repsDone: 9 })
    const after = markers({ phase: 'done', repsDone: 10 })
    expect(getResetReason(before, after)).toBeNull()
    expect(shouldResetForTransition(before, after)).toBe(false)
  })

  it('returns "intro-complete" when finishing the parent walkthrough', () => {
    const before = markers({ phase: 'intro' })
    const after = markers({ phase: 'building', currentStep: 1 })
    expect(getResetReason(before, after)).toBe('intro-complete')
  })
})

describe('bannerForResetReason', () => {
  it('announces the setup-complete transition in success green', () => {
    const banner = bannerForResetReason(
      'to-repeating',
      markers({ phase: 'repeating', currentStep: 3, repsDone: 0 }),
    )
    expect(banner.kind).toBe('setup-complete')
    expect(banner.text).toContain('Aufbau geschafft')
    expect(banner.text).toContain(`${TARGET_REPS}×`)
  })

  it('shows a singular "Zug" when the user only has one memorized move', () => {
    const banner = bannerForResetReason('next-step', markers({ currentStep: 2 }))
    expect(banner.kind).toBe('memory')
    expect(banner.text).toBe('Spiele 1 Zug aus dem Gedächtnis')
  })

  it('pluralizes to "Züge" once multiple steps are memorized', () => {
    const banner = bannerForResetReason('next-step', markers({ currentStep: 4 }))
    expect(banner.kind).toBe('memory')
    expect(banner.text).toBe('Spiele 3 Züge aus dem Gedächtnis')
  })

  it('shows a neutral memory banner for ordinary repetitions', () => {
    const banner = bannerForResetReason(
      'next-rep',
      markers({ phase: 'repeating', repsDone: 3 }),
    )
    expect(banner.kind).toBe('memory')
    expect(banner.text).toBe(`Durchgang 4/${TARGET_REPS} · auswendig`)
  })

  it('upgrades the memory banner to a green motivation banner at exactly halfway', () => {
    const halfway = Math.floor(TARGET_REPS / 2)
    const banner = bannerForResetReason(
      'next-rep',
      markers({ phase: 'repeating', repsDone: halfway }),
    )
    expect(banner.kind).toBe('motivation')
    expect(banner.text).toContain('Halbzeit')
    expect(banner.text).toContain(`${halfway}/${TARGET_REPS}`)
  })

  it('announces intro completion with a dedicated setup-complete banner', () => {
    const banner = bannerForResetReason(
      'intro-complete',
      markers({ phase: 'building', currentStep: 1 }),
    )
    expect(banner.kind).toBe('setup-complete')
    expect(banner.text).toContain('Grundposition')
  })

  it('does NOT show the motivation banner on reps adjacent to halfway', () => {
    const halfway = Math.floor(TARGET_REPS / 2)
    const before = bannerForResetReason(
      'next-rep',
      markers({ phase: 'repeating', repsDone: halfway - 1 }),
    )
    const after = bannerForResetReason(
      'next-rep',
      markers({ phase: 'repeating', repsDone: halfway + 1 }),
    )
    expect(before.kind).toBe('memory')
    expect(after.kind).toBe('memory')
  })
})

describe('MISTAKE_BANNER_TEXT', () => {
  it('is a concise, actionable error message', () => {
    expect(MISTAKE_BANNER_TEXT.length).toBeGreaterThan(0)
    expect(MISTAKE_BANNER_TEXT.toLowerCase()).toContain('zug')
  })
})

describe('willMoveTriggerReset', () => {
  const italianGame: Line = {
    id: 'C50-italian-game',
    eco: 'C50',
    fullName: 'Italian Game',
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4',
    sanMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    userSide: 'white',
  }

  it('reports false for opponent replies that stay inside a step', () => {
    // After the user plays e4 the session sits in step 2 and expects the
    // opponent's e5. That reply only advances the cursor – no reset – so
    // the board should stay unlocked and premovable.
    let state = startSession(italianGame)
    state = submitMove(state, 'e4').state
    state = submitMove(state, 'e5').state
    state = submitMove(state, 'Nf3').state
    // Now expecting opponent's Nc6 in step 3. After Nc6 the user still
    // owes Bc4 before the step closes, so no reset is queued.
    expect(willMoveTriggerReset(state, 'Nc6')).toBe(false)
  })

  it('reports true when the opponent reply will finish the line (enter done)', () => {
    const blackToResign: Line = {
      ...italianGame,
      id: 'test-last-move-opponent',
      sanMoves: ['e4', 'e5'],
      userSide: 'white',
    }
    // Drill the line up to the last rep: after the user plays e4 for the
    // TARGET_REPS-th time, the opponent's e5 closes the final rep and the
    // session transitions to done -> board is about to reset into the
    // next-line pipeline.
    let state = startSession(blackToResign)
    state = submitMove(state, 'e4').state
    // Enter repeating (skip the 1-step build).
    while (state.phase !== 'repeating' && state.phase !== 'done') {
      const next = submitMove(state, state.expectedSan!).state
      if (next === state) break
      state = next
    }
    // Play every move of each rep except the final one of the final rep.
    while (state.phase === 'repeating' && state.repsDone < TARGET_REPS - 1) {
      state = submitMove(state, state.expectedSan!).state
    }
    // Now we are inside the last rep. Fast-forward to the point where the
    // opponent is about to play their closing move.
    state = submitMove(state, 'e4').state
    expect(state.phase).toBe('repeating')
    expect(willMoveTriggerReset(state, 'e5')).toBe(true)
  })

  it('reports false for a wrong SAN – nothing to guard against', () => {
    const state = startSession(italianGame)
    // With the opponent's move being e5, feed a wrong SAN: should not
    // claim a reset will happen (the session will simply reject it).
    expect(willMoveTriggerReset(state, 'garbage')).toBe(false)
  })
})
