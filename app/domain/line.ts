import type { Side } from './types'

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

export const userSideForPgn = (_sanMoves: string[]): Side => {
  return 'white'
}
