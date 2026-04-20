import type { Family, Line, LineProgress, Topic } from './types'

export type SelectionFocus =
  | { kind: 'topic' }
  | { kind: 'family'; familyId: string }
  | { kind: 'line'; lineId: string }

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
  const mastered = masteredIds(progress)
  if (!mastered.has(focus.lineId)) {
    return family.lines.find((l) => l.id === focus.lineId) ?? null
  }
  const inFamily = selectNextLineInFamily(family, progress)
  if (inFamily) return inFamily
  return selectFromFamilyOnward(topic, family.id, progress)
}
