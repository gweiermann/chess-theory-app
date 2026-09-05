import type { MasteredLine } from './mastered-pool'

/**
 * Focus mode for the random trainer (`/learn/practice`).
 *
 * Rounds are biased toward one mastered *family* (e.g. "Italienisch") instead
 * of being drawn uniformly across all mastered lines. The family on focus is
 * chosen at session start (weighted by how many maximal masteries it holds)
 * and drifts away as a short-handed, session-local estimate of the player's
 * mastery grows. The mode never writes mastery to storage: the assessment and
 * the focus are ephemeral and start fresh on every visit.
 */

export const MASTERY_MAX = 10
/** Switch probability when a family has just become the focus (mastery 0). */
const SWITCH_LOW = 0.1
/** Slope that maps mastery in [0, MASTERY_MAX] onto the switching window. */
const SWITCH_SLOPE = 0.6

const GAIN_ON_TARGET = 1
const LOSS_ON_MISTAKE = -1
const PARTIAL_GAIN = 0.5

export interface RoundPerformance {
  /** Round followed the target without mistakes (the +5 bonus tripped). */
  targetMet: boolean
  /** Number of wrong moves made this round. */
  mistakes: number
}

export interface FocusFamily {
  id: string
  name: string
  /** Maximal mastered lines that belong to this family. */
  lines: MasteredLine[]
}

export interface FocusState {
  /** Id of the family currently on focus; null until the first round picks one. */
  currentFamilyId: string | null
  /** Session-local self-assessment per family id, clamped to [0, MASTERY_MAX]. */
  masteryByFamily: Record<string, number>
}

const clampMastery = (n: number): number => Math.min(MASTERY_MAX, Math.max(0, n))

const isStrictPrefix = (prefix: readonly string[], candidate: readonly string[]): boolean =>
  candidate.length > prefix.length &&
  prefix.every((san, i) => san === candidate[i])

/**
 * Drop mastered lines that are a strict prefix of a longer mastered line.
 * Only the longest known variations are ever offered as a round target, so
 * the pool never asks the player to repeat a line they already know extends
 * further. Non-prefix siblings are all kept.
 */
export const keepMaximal = (lines: readonly MasteredLine[]): MasteredLine[] =>
  lines.filter((a) => !lines.some((b) => b !== a && isStrictPrefix(a.sanMoves, b.sanMoves)))

/** Group mastered lines by family, preserving first-seen order. */
export const groupByFamily = (lines: readonly MasteredLine[]): FocusFamily[] => {
  const byId = new Map<string, FocusFamily>()
  for (const line of lines) {
    let fam = byId.get(line.familyId)
    if (!fam) {
      fam = { id: line.familyId, name: line.familyName, lines: [] }
      byId.set(line.familyId, fam)
    }
    fam.lines.push(line)
  }
  return [...byId.values()]
}

const pickWeightedFamily = (
  families: readonly FocusFamily[],
  rng: () => number,
  excludeId?: string,
): FocusFamily | null => {
  const pool = excludeId ? families.filter((f) => f.id !== excludeId) : [...families]
  if (pool.length === 0) return null
  const total = pool.reduce((sum, f) => sum + f.lines.length, 0)
  if (total <= 0) return pool[0] ?? null
  let r = rng() * total
  for (const f of pool) {
    r -= f.lines.length
    if (r < 0) return f
  }
  return pool[pool.length - 1] ?? null
}

/** Pick the family the player starts focused on, weighted by maximal line count. */
export const pickInitialFamily = (
  families: readonly FocusFamily[],
  rng: () => number,
): FocusFamily => pickWeightedFamily(families, rng) ?? families[0] ?? { id: '', name: '', lines: [] }

/** Pick a different family from the current focus, weighted by maximal line count. */
export const pickSideFamily = (
  families: readonly FocusFamily[],
  currentId: string,
  rng: () => number,
): FocusFamily | null => pickWeightedFamily(families, rng, currentId)

/** Draw a random maximal line within a focus family as the round target. */
export const pickTargetLine = (
  family: FocusFamily,
  rng: () => number,
  avoidId?: string,
): MasteredLine | null => {
  const candidates =
    avoidId != null && family.lines.length > 1
      ? family.lines.filter((l) => l.id !== avoidId)
      : family.lines
  if (candidates.length === 0) return family.lines[0] ?? null
  const idx = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))
  return candidates[idx] ?? null
}

/**
 * Probability of leaving the current focus after a round, based on the
 * player's session-local mastery of that family: fresh (0) → 0.1, maxed (10)
 * → 0.7.
 */
export const switchProbability = (mastery: number): number =>
  SWITCH_LOW + SWITCH_SLOPE * (clampMastery(mastery) / MASTERY_MAX)

/** Adjust a family's mastery from one completed round, clamped to [0, MASTERY_MAX]. */
export const updateMastery = (mastery: number, performance: RoundPerformance): number => {
  const delta = performance.targetMet
    ? GAIN_ON_TARGET
    : performance.mistakes > 0
      ? LOSS_ON_MISTAKE
      : PARTIAL_GAIN
  return clampMastery(mastery + delta)
}

/**
 * Advance the focus after a completed round: fold the round's performance into
 * the current family's mastery, then either stay on the family or (with
 * probability `switchProbability`) jump to a different one weighted by how
 * much mastered content it holds. Returns the new state and whether the focus
 * family changed.
 */
export const decideNextFocus = (
  state: FocusState,
  families: readonly FocusFamily[],
  performance: RoundPerformance,
  rng: () => number,
): { next: FocusState; switched: boolean } => {
  if (families.length === 0) return { next: state, switched: false }

  const currentId = state.currentFamilyId
  const masteryByFamily = { ...state.masteryByFamily }
  if (currentId) {
    const mastery = state.masteryByFamily[currentId] ?? 0
    masteryByFamily[currentId] = updateMastery(mastery, performance)
  }

  if (!currentId) {
    const fam = pickInitialFamily(families, rng)
    return { next: { currentFamilyId: fam.id, masteryByFamily }, switched: false }
  }

  const p = switchProbability(masteryByFamily[currentId] ?? 0)
  if (rng() < p) {
    const other = pickSideFamily(families, currentId, rng)
    if (other) {
      return { next: { currentFamilyId: other.id, masteryByFamily }, switched: true }
    }
  }
  return { next: { currentFamilyId: currentId, masteryByFamily }, switched: false }
}
