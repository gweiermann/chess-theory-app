import { TARGET_REPS } from './session'

/**
 * The learn screen shows a single contextual banner above the chessboard.
 * Each kind maps to its own color + icon in the UI so the user can tell at a
 * glance what the app is trying to communicate. The logic that decides which
 * banner to show based on a phase-marker transition lives here (pure) so it
 * can be unit-tested without mounting the whole page component.
 *
 *  - `hint`           – "Neuer Zug – probiere ihn aus: <san>" paired with
 *                       the on-board arrow; shown when a new step's move is
 *                       being demonstrated.
 *  - `memory`         – "from memory" blue banner after a step/rep reset.
 *  - `setup-complete` – celebratory green banner when the building phase is
 *                       done and the 10-rep drill starts.
 *  - `motivation`     – halfway-through-the-reps green nudge.
 *  - `mistake`        – short red "wrong move" banner.
 */
export type BannerKind = 'hint' | 'memory' | 'setup-complete' | 'motivation' | 'mistake'

export interface Banner {
  kind: BannerKind
  text: string
}

/**
 * A stripped-down view of the relevant parts of {@link SessionState} that
 * drive the reset banner. Kept as a standalone shape so the UI layer can
 * build it on demand without over-coupling.
 */
export interface PhaseMarkers {
  phase: 'intro' | 'building' | 'repeating' | 'done'
  currentStep: number
  repsDone: number
}

export type ResetReason =
  | 'intro-complete'
  | 'next-step'
  | 'to-repeating'
  | 'next-rep'

/**
 * Classify a phase-marker transition into the reason that triggers a board
 * reset. Returns `null` when no reset is warranted (e.g. the session is just
 * progressing inside a step).
 */
export const getResetReason = (
  before: PhaseMarkers,
  after: PhaseMarkers,
): ResetReason | null => {
  if (after.phase === 'done') return null
  if (before.phase === 'intro' && after.phase === 'building') return 'intro-complete'
  if (before.phase === 'building' && after.phase === 'repeating') return 'to-repeating'
  if (
    before.phase === 'building'
    && after.phase === 'building'
    && after.currentStep > before.currentStep
  ) return 'next-step'
  if (
    before.phase === 'repeating'
    && after.phase === 'repeating'
    && after.repsDone > before.repsDone
  ) return 'next-rep'
  return null
}

export const shouldResetForTransition = (
  before: PhaseMarkers,
  after: PhaseMarkers,
): boolean => getResetReason(before, after) !== null

const HALFWAY_REPS = Math.floor(TARGET_REPS / 2)

/**
 * Produce the banner shown immediately after a reset, given what caused the
 * reset and the session state after the transition. The halfway motivational
 * banner takes precedence over the memory banner on the one rep where it
 * applies so the user gets a single, visible nudge per line.
 */
export const bannerForResetReason = (
  reason: ResetReason,
  after: PhaseMarkers,
): Banner => {
  if (reason === 'intro-complete') {
    return {
      kind: 'setup-complete',
      text: 'Grundposition erreicht – jetzt die Erweiterung',
    }
  }
  if (reason === 'to-repeating') {
    return {
      kind: 'setup-complete',
      text: `Aufbau geschafft – ${TARGET_REPS}× auswendig`,
    }
  }
  if (reason === 'next-rep') {
    if (after.repsDone === HALFWAY_REPS) {
      return {
        kind: 'motivation',
        text: `Halbzeit – weiter so! (${after.repsDone}/${TARGET_REPS})`,
      }
    }
    return {
      kind: 'memory',
      text: `Durchgang ${after.repsDone + 1}/${TARGET_REPS} · auswendig`,
    }
  }
  // `next-step`: the user unlocked a new step; they now need to replay all
  // previously learned user moves from the initial position before the new
  // step's hint arrow is armed. The count is intentionally kept compact so
  // the banner stays on a single line on 390px-wide viewports (otherwise
  // the board would shift down when the banner wraps).
  const memorizedCount = Math.max(after.currentStep - 1, 1)
  const movesWord = memorizedCount === 1 ? 'Zug' : 'Züge'
  return {
    kind: 'memory',
    text: `Spiele ${memorizedCount} ${movesWord} aus dem Gedächtnis`,
  }
}

/**
 * The short red banner text shown when the user submits the wrong move.
 * Exposed here so tests and the UI share the exact copy.
 */
export const MISTAKE_BANNER_TEXT = 'Falscher Zug – nochmal versuchen'
