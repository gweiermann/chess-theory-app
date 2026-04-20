import type { Family, LineProgress } from './types'

export const initialProgress = (lineId: string): LineProgress => ({
  lineId,
  status: 'new',
  reps: 0,
})

export const markInProgress = (
  current: LineProgress,
  reps: number,
  now: number,
): LineProgress => ({
  ...current,
  status: 'in-progress',
  reps,
  lastPracticedAt: now,
})

export const markMastered = (
  current: LineProgress,
  now: number,
): LineProgress => ({
  ...current,
  status: 'mastered',
  reps: Math.max(current.reps, 10),
  lastPracticedAt: now,
})

export const isMastered = (p: LineProgress): boolean => p.status === 'mastered'

export interface MasteryCounts {
  totalLines: number
  mastered: number
}

export const topicMasteryRatio = ({
  totalLines,
  mastered,
}: MasteryCounts): number => {
  if (totalLines <= 0) return 0
  return mastered / totalLines
}

const masteredLineIdSet = (progress: readonly LineProgress[]): Set<string> => {
  const set = new Set<string>()
  for (const p of progress) {
    if (p.status === 'mastered') set.add(p.lineId)
  }
  return set
}

export const isFamilyMastered = (
  family: Family,
  progress: readonly LineProgress[],
): boolean => {
  if (family.lines.length === 0) return false
  const mastered = masteredLineIdSet(progress)
  return family.lines.every((line) => mastered.has(line.id))
}

export const countMasteredFamilies = (
  families: readonly Family[],
  progress: readonly LineProgress[],
): number => families.reduce((sum, f) => sum + (isFamilyMastered(f, progress) ? 1 : 0), 0)

export const topicFamilyMasteryRatio = (
  families: readonly Family[],
  progress: readonly LineProgress[],
): number => {
  if (families.length === 0) return 0
  return countMasteredFamilies(families, progress) / families.length
}
