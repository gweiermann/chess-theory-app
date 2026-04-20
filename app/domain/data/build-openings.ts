import {
  buildLineId,
  parsePgnToSan,
  splitFamilyAndPath,
  userSideForPgn,
} from '../line'
import { buildFamilyTree } from '../tree'
import type {
  Family,
  Line,
  OpeningsDataset,
  Topic,
} from '../types'

export const TOPIC_ORDER = ['e4', 'd4', 'c4', 'Nf3', 'other'] as const

export const TOPIC_LABELS: Record<string, string> = {
  e4: '1.e4',
  d4: '1.d4',
  c4: '1.c4',
  Nf3: '1.Nf3',
  other: 'Other openings',
}

interface Row {
  eco: string
  fullName: string
  pgn: string
}

const parseTsv = (raw: string): Row[] => {
  const lines = raw.split(/\r?\n/)
  const rows: Row[] = []
  let headerSeen = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.length === 0) continue
    if (line.startsWith('#')) continue

    const cells = line.split('\t')
    if (cells.length < 3) continue

    if (!headerSeen) {
      headerSeen = true
      if (cells[0]!.toLowerCase() === 'eco') continue
    }

    rows.push({
      eco: cells[0]!.trim(),
      fullName: cells[1]!.trim(),
      pgn: cells[2]!.trim(),
    })
  }

  return rows
}

const slug = (input: string): string =>
  input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['`’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const topicIdForFirstSan = (san: string | undefined): string => {
  if (!san) return 'other'
  if (san === 'e4' || san === 'd4' || san === 'c4' || san === 'Nf3') return san
  return 'other'
}

const sortByEcoThenName = (a: Line, b: Line): number => {
  if (a.eco === b.eco) return a.fullName.localeCompare(b.fullName)
  return a.eco.localeCompare(b.eco)
}

export const buildDatasetFromTsv = (tsv: string): OpeningsDataset => {
  const rows = parseTsv(tsv)
  const linesByTopic = new Map<string, Map<string, Line[]>>()

  for (const row of rows) {
    const sanMoves = parsePgnToSan(row.pgn)
    if (sanMoves.length === 0) continue
    const topicId = topicIdForFirstSan(sanMoves[0])
    const { family } = splitFamilyAndPath(row.fullName)

    const line: Line = {
      id: buildLineId(row.eco, row.fullName),
      eco: row.eco,
      fullName: row.fullName,
      pgn: row.pgn,
      sanMoves,
      userSide: userSideForPgn(sanMoves),
    }

    let families = linesByTopic.get(topicId)
    if (!families) {
      families = new Map()
      linesByTopic.set(topicId, families)
    }
    let lines = families.get(family)
    if (!lines) {
      lines = []
      families.set(family, lines)
    }
    lines.push(line)
  }

  const topics: Topic[] = []
  const topicIdsInOrder = [
    ...TOPIC_ORDER.filter((id) => linesByTopic.has(id)),
    ...[...linesByTopic.keys()]
      .filter((id) => !TOPIC_ORDER.includes(id as (typeof TOPIC_ORDER)[number]))
      .sort(),
  ]

  for (const topicId of topicIdsInOrder) {
    const families = linesByTopic.get(topicId)!
    const familyEntries = [...families.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )
    const familyObjects: Family[] = familyEntries.map(([name, lines]) => {
      lines.sort(sortByEcoThenName)
      return {
        id: slug(name),
        name,
        lines,
        tree: buildFamilyTree(lines),
      }
    })

    topics.push({
      id: topicId,
      firstMove: topicId === 'other' ? '' : topicId,
      label: TOPIC_LABELS[topicId] ?? topicId,
      families: familyObjects,
    })
  }

  return {
    generatedAt: new Date().toISOString(),
    topics,
  }
}
