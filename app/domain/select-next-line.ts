import type { Family, Line, LineProgress, Topic } from './types'

export type SelectionFocus =
  | { kind: 'topic' }
  | { kind: 'family'; familyId: string }
  | { kind: 'line'; lineId: string; exclusive?: boolean }

const masteredIds = (progress: readonly LineProgress[]): Set<string> => {
  const set = new Set<string>()
  for (const p of progress) if (p.status === 'mastered') set.add(p.lineId)
  return set
}

export const selectNextLine = (
  topic: Topic,
  progress: readonly LineProgress[],
): Line | null => {
  const mastered = masteredIds(progress)
  for (const family of topic.families) {
    for (const line of family.lines) {
      if (!mastered.has(line.id)) return line
    }
  }
  return null
}

export const selectNextLineInFamily = (
  family: Family,
  progress: readonly LineProgress[],
): Line | null => {
  const mastered = masteredIds(progress)
  for (const line of family.lines) {
    if (!mastered.has(line.id)) return line
  }
  return null
}

const findFamilyContainingLine = (
  topic: Topic,
  lineId: string,
): Family | null => {
  for (const family of topic.families) {
    if (family.lines.some((l) => l.id === lineId)) return family
  }
  return null
}

const selectFromFamilyOnward = (
  topic: Topic,
  startFamilyId: string,
  progress: readonly LineProgress[],
): Line | null => {
  const startIdx = topic.families.findIndex((f) => f.id === startFamilyId)
  if (startIdx === -1) return null
  const mastered = masteredIds(progress)
  for (let i = startIdx; i < topic.families.length; i += 1) {
    const family = topic.families[i]!
    for (const line of family.lines) {
      if (!mastered.has(line.id)) return line
    }
  }
  return null
}

export const selectLineForFocus = (
  topic: Topic,
  focus: SelectionFocus,
  progress: readonly LineProgress[],
): Line | null => {
  if (focus.kind === 'topic') return selectNextLine(topic, progress)

  if (focus.kind === 'family') {
    const family = topic.families.find((f) => f.id === focus.familyId)
    if (!family) return null
    const inFamily = selectNextLineInFamily(family, progress)
    if (inFamily) return inFamily
    return selectFromFamilyOnward(topic, family.id, progress)
  }

  const family = findFamilyContainingLine(topic, focus.lineId)
  if (!family) return null
  // When the user explicitly requested a specific line (e.g. via the "Back
  // to parent" button, which always lands on a mastered ancestor) we honor
  // that request rather than auto-advancing past it. Without `exclusive` we
  // keep the old fallback for the auto-progression path.
  if (focus.exclusive) {
    return family.lines.find((l) => l.id === focus.lineId) ?? null
  }
  const mastered = masteredIds(progress)
  if (!mastered.has(focus.lineId)) {
    return family.lines.find((l) => l.id === focus.lineId) ?? null
  }
  const inFamily = selectNextLineInFamily(family, progress)
  if (inFamily) return inFamily
  return selectFromFamilyOnward(topic, family.id, progress)
}

/**
 * Find the longest mastered sibling in the same family whose move list is a
 * strict prefix of {@link line}'s moves. Used to treat already-learned moves
 * as "setup" so that drilling a child line (e.g. "Italian Game: Classical
 * Variation") does not force the user to re-learn the parent's moves.
 *
 * Requirements:
 *   - Same family (same entry point, same tree), otherwise the two lines
 *     would never share a prefix semantically.
 *   - Same `userSide` – a defense parent for a non-defense child would put
 *     the user on the wrong side of the board.
 *   - Mastered – we only strip moves the user has already proven.
 *   - Strict prefix – equal move counts are siblings, not parents.
 */
export const findParentLine = (
  family: Family,
  line: Line,
  progress: readonly LineProgress[],
): Line | null => {
  const mastered = masteredIds(progress)
  let best: Line | null = null

  for (const candidate of family.lines) {
    if (candidate.id === line.id) continue
    if (!mastered.has(candidate.id)) continue
    if (candidate.userSide !== line.userSide) continue
    if (candidate.sanMoves.length === 0) continue
    if (candidate.sanMoves.length >= line.sanMoves.length) continue

    let isPrefix = true
    for (let i = 0; i < candidate.sanMoves.length; i += 1) {
      if (candidate.sanMoves[i] !== line.sanMoves[i]) {
        isPrefix = false
        break
      }
    }
    if (!isPrefix) continue

    if (!best || candidate.sanMoves.length > best.sanMoves.length) {
      best = candidate
    }
  }

  return best
}
