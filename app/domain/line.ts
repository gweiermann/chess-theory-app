import type { FamilyCategory, Side } from './types'

export interface FamilyAndPath {
  family: string
  path: string[]
}

export const splitFamilyAndPath = (fullName: string): FamilyAndPath => {
  const colonIndex = fullName.indexOf(':')
  if (colonIndex === -1) {
    return { family: fullName.trim(), path: [] }
  }

  const family = fullName.slice(0, colonIndex).trim()
  const remainder = fullName.slice(colonIndex + 1).trim()
  const path = remainder
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

  return { family, path }
}

/**
 * Gambit sub-variants of an opening are published in the Lichess TSV with
 * names like "Queen's Gambit Accepted" or "Danish Gambit Declined" and end
 * up as siblings of the parent family. The user wants both halves folded
 * back into the parent so that e.g. "Queen's Gambit", "Queen's Gambit
 * Accepted" and "Queen's Gambit Declined" share one group in the UI. We
 * drop a trailing " Accepted"/" Declined" from the family name (but leave
 * it in the line's full name, so the user can still see which branch they
 * are drilling).
 */
export const normalizeFamilyName = (family: string): string => {
  const trimmed = family.trim()
  if (/ (Accepted|Declined)$/i.test(trimmed)) {
    return trimmed.replace(/ (Accepted|Declined)$/i, '').trim()
  }
  return trimmed
}

/**
 * Families whose name is "<x> Defense" are drilled from black's perspective
 * (the whole point of a defense is that white moves first and you answer).
 * This detection intentionally uses the original family name – not the
 * normalized one – so it still works if we ever get a "<x> Defense Accepted"
 * oddity without silently flipping the board.
 */
export const isDefenseFamily = (family: string): boolean =>
  / Defense$/i.test(family.trim())

const GAMBIT_PATTERN = /\b(gambit|countergambit)\b/i

/**
 * Classify a family into one of three top-level buckets used to group the
 * /openings/<topic> list. "Defense" takes priority over "Gambit" because
 * some oddball families contain both words (e.g. a hypothetical "Polish
 * Gambit Defense") and the user expects defenses to flip the board.
 */
export const classifyFamily = (family: string): FamilyCategory => {
  const trimmed = family.trim()
  if (isDefenseFamily(trimmed)) return 'defense'
  if (GAMBIT_PATTERN.test(trimmed)) return 'gambit'
  return 'opening'
}

const MOVE_NUMBER_PATTERN = /^\d+\.+$/

export const parsePgnToSan = (pgn: string): string[] => {
  const trimmed = pgn.trim()
  if (trimmed.length === 0) return []

  return trimmed
    .split(/\s+/)
    .map((token) => {
      const cleaned = token.replace(/^\d+\.{1,3}/, '')
      return cleaned
    })
    .filter((token) => token.length > 0 && !MOVE_NUMBER_PATTERN.test(token))
}

export const firstMoveTopicId = (sanMoves: string[]): string | null => {
  const first = sanMoves[0]
  return first ?? null
}

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['`’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const buildLineId = (eco: string, fullName: string): string => {
  return `${eco}-${slugify(fullName)}`
}

/**
 * Choose which side the user plays. Defenses are practised from black so
 * that white (the opponent) always opens and the user answers; everything
 * else the user plays from white. This is kept as a single entry point so
 * the same derivation is available to tests, the pre-processing script,
 * and any runtime reclassification.
 */
export const userSideForLine = (family: string, _sanMoves: string[]): Side => {
  return isDefenseFamily(family) ? 'black' : 'white'
}

/** @deprecated Kept for tests that predate the defense-aware variant. */
export const userSideForPgn = (_sanMoves: string[]): Side => 'white'
