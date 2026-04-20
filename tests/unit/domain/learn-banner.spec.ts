import { describe, expect, it } from 'vitest'
import {
  MISTAKE_BANNER_TEXT,
  bannerForResetReason,
  getResetReason,
  shouldResetForTransition,
  type PhaseMarkers,
} from '~/domain/learn-banner'
import { TARGET_REPS } from '~/domain/session'

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
