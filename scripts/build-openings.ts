import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile, readdir, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Chess } from 'chess.js'
import type { Catalog, Family, OpeningLine } from '../app/modules/shared'

const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const topicNames: Record<string, string> = {
  e4: 'King’s Pawn',
  d4: 'Queen’s Pawn',
  c4: 'English',
  Nf3: 'Réti',
  other: 'Other openings',
}

/** Parses each source row independently: display names are never record keys. */
export function parseSource(text: string, sourceId: string): OpeningLine[] {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  if (rows.shift() !== 'eco\tname\tpgn')
    throw new Error(`${sourceId}: expected eco, name, pgn TSV header`)
  const duplicates = new Map<string, number>()
  return rows.flatMap((row, index) => {
    if (!row.trim()) return []
    const columns = row.split('\t')
    const [eco, name, pgn] = columns
    if (
      columns.length !== 3 ||
      !eco ||
      !/^[A-E]\d{2}$/.test(eco) ||
      !name ||
      !pgn
    )
      throw new Error(`${sourceId}:${index + 2}: malformed opening record`)
    const game = new Chess()
    try {
      game.loadPgn(pgn, { strict: true })
    } catch (error) {
      throw new Error(
        `${sourceId}:${index + 2}: invalid PGN: ${String(error)}`,
        { cause: error },
      )
    }
    const moves = game.history()
    if (!moves.length)
      throw new Error(`${sourceId}:${index + 2}: PGN has no moves`)
    const topicId = ['e4', 'd4', 'c4', 'Nf3'].includes(moves[0]!)
      ? moves[0]!
      : 'other'
    const familyName = name.split(':')[0]!.trim()
    const familyId = `${familyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${hash(`${topicId}\0${familyName}`).slice(0, 8)}`
    const identity = `${sourceId}\0${row}`
    const occurrence = duplicates.get(identity) ?? 0
    duplicates.set(identity, occurrence + 1)
    return [
      {
        id: `${eco}-${hash(`${identity}\0${occurrence}`).slice(0, 20)}`,
        eco,
        name,
        familyId,
        topicId,
        moves,
        suggestedSide: /defen[cs]e/i.test(name)
          ? ('black' as const)
          : ('white' as const),
      },
    ]
  })
}

export async function buildOpenings(root = process.cwd()): Promise<Catalog> {
  const sourceFiles = ['a', 'b', 'c', 'd', 'e'].map((letter) => `${letter}.tsv`)
  const contents = await Promise.all(
    sourceFiles.map((file) =>
      readFile(resolve(root, 'data/source', file), 'utf8'),
    ),
  )
  const revision = hash(
    'italian-only-v1\0' +
      contents
        .map((text, index) => `${sourceFiles[index]}\0${text}`)
        .join('\0'),
  )
  const lines = contents
    .flatMap((text, index) => parseSource(text, sourceFiles[index]!))
    .filter((line) => line.name.split(':')[0]!.trim() === 'Italian Game')
  const groups = new Map<string, OpeningLine[]>()
  for (const line of lines)
    groups.set(line.familyId, [...(groups.get(line.familyId) ?? []), line])
  const families: Family[] = [...groups].map(([id, records]) => ({
    summary: {
      id,
      name: records[0]!.name.split(':')[0]!.trim(),
      topicId: records[0]!.topicId,
      lineCount: records.length,
    },
    lines: records,
  }))
  families.sort((a, b) => a.summary.name.localeCompare(b.summary.name))
  const catalog: Catalog = {
    version: 1,
    revision,
    lineCount: lines.length,
    families: families.map((family) => family.summary),
    topics: Object.entries(topicNames)
      .map(([id, name]) => ({
        id,
        name,
        familyCount: families.filter((family) => family.summary.topicId === id)
          .length,
        lineCount: lines.filter((line) => line.topicId === id).length,
      }))
      .filter((topic) => topic.lineCount > 0),
  }
  const output = resolve(root, 'public/data')
  await mkdir(resolve(output, 'families'), { recursive: true })
  const activeFiles = new Set(
    families.map((family) => `${family.summary.id}.json`),
  )
  // Remove obsolete generated families when narrowing the delivered repertoire.
  for (const filename of await readdir(resolve(output, 'families')))
    if (filename.endsWith('.json') && !activeFiles.has(filename))
      await unlink(resolve(output, 'families', filename))
  await Promise.all(
    families.map((family) =>
      writeFile(
        resolve(output, 'families', `${family.summary.id}.json`),
        JSON.stringify(family),
      ),
    ),
  )
  await writeFile(resolve(output, 'catalog.json'), JSON.stringify(catalog))
  await writeFile(
    resolve(output, 'manifest.json'),
    JSON.stringify(
      {
        version: 1,
        scope: 'Italian Game',
        revision,
        source: {
          url: 'https://github.com/lichess-org/chess-openings',
          upstreamCommit: null,
          pin: 'SHA-256 of vendored source contents',
          files: sourceFiles.map((file, index) => ({
            file,
            sha256: hash(contents[index]!),
          })),
        },
        acceptedRecords: lines.length,
        deliveredRecords: families.reduce(
          (total, family) => total + family.lines.length,
          0,
        ),
        families: families.length,
      },
      null,
      2,
    ),
  )
  return catalog
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const catalog = await buildOpenings()
  console.log(
    `Built ${catalog.lineCount} opening records in ${catalog.families.length} families (${catalog.revision}).`,
  )
}
