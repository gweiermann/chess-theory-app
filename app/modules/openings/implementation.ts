import { Chess } from 'chess.js'
import type { Catalog, Family, OpeningLine } from '../shared'
import type { OpeningLibrary, Repertoire } from './public'

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
const count = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0
const summary = (value: unknown) =>
  object(value) &&
  text(value.id) &&
  text(value.name) &&
  text(value.topicId) &&
  count(value.lineCount)

function immutable<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) immutable(child)
    Object.freeze(value)
  }
  return value
}

function validateCatalog(value: unknown): Catalog {
  if (
    !object(value) ||
    value.version !== 1 ||
    !text(value.revision) ||
    !count(value.lineCount) ||
    !Array.isArray(value.families) ||
    !Array.isArray(value.topics)
  )
    throw new Error('Invalid opening catalog')
  if (
    !value.families.every(summary) ||
    !value.topics.every(
      (topic) =>
        object(topic) &&
        text(topic.id) &&
        text(topic.name) &&
        count(topic.lineCount) &&
        count(topic.familyCount),
    )
  )
    throw new Error('Invalid opening catalog summaries')
  const catalog = value as unknown as Catalog
  const ids = new Set(catalog.families.map((family) => family.id))
  const topicIds = new Set(catalog.topics.map((topic) => topic.id))
  if (
    ids.size !== catalog.families.length ||
    topicIds.size !== catalog.topics.length ||
    catalog.families.reduce((total, family) => total + family.lineCount, 0) !==
      catalog.lineCount ||
    catalog.topics.reduce((total, topic) => total + topic.lineCount, 0) !==
      catalog.lineCount
  )
    throw new Error('Invalid opening catalog counts')
  for (const family of catalog.families)
    if (!topicIds.has(family.topicId)) throw new Error('Unknown opening topic')
  for (const topic of catalog.topics) {
    const families = catalog.families.filter(
      (family) => family.topicId === topic.id,
    )
    if (
      families.length !== topic.familyCount ||
      families.reduce((total, family) => total + family.lineCount, 0) !==
        topic.lineCount
    )
      throw new Error('Invalid topic counts')
  }
  return immutable(catalog)
}

function validateFamily(
  value: unknown,
  expected: Catalog['families'][number],
): Family {
  if (!object(value) || !summary(value.summary) || !Array.isArray(value.lines))
    throw new Error('Invalid opening family')
  const family = value as unknown as Family
  if (
    family.summary.id !== expected.id ||
    family.summary.topicId !== expected.topicId ||
    family.summary.name !== expected.name ||
    family.summary.lineCount !== expected.lineCount ||
    family.lines.length !== expected.lineCount
  )
    throw new Error('Invalid opening family identity or counts')
  const ids = new Set<string>()
  for (const candidate of value.lines) {
    if (
      !object(candidate) ||
      !text(candidate.id) ||
      !text(candidate.eco) ||
      !/^[A-E]\d{2}$/.test(candidate.eco) ||
      !text(candidate.name) ||
      candidate.familyId !== expected.id ||
      candidate.topicId !== expected.topicId ||
      !['white', 'black'].includes(String(candidate.suggestedSide)) ||
      !Array.isArray(candidate.moves) ||
      !candidate.moves.length ||
      !candidate.moves.every(text) ||
      ids.has(candidate.id)
    )
      throw new Error('Invalid opening line record')
    const game = new Chess()
    try {
      for (const move of candidate.moves) {
        const played = game.move(move, { strict: true })
        if (played.san !== move) throw new Error('Noncanonical SAN')
      }
    } catch {
      throw new Error(`Invalid opening line moves: ${candidate.id}`)
    }
    ids.add(candidate.id)
  }
  return immutable(family)
}

/** Loading is scoped: requesting one family never downloads another family. */
export function createOpeningLibrary(
  options: { baseUrl?: string; fetch?: typeof globalThis.fetch } = {},
): OpeningLibrary {
  const request = options.fetch ?? globalThis.fetch
  const base = (options.baseUrl ?? '/data').replace(/\/$/, '')
  let catalogPromise: Promise<Catalog> | undefined
  const families = new Map<string, Promise<Family>>()
  async function json(path: string): Promise<unknown> {
    const response = await request(`${base}/${path}`)
    if (!response.ok)
      throw new Error(
        `Opening data request failed (${response.status}): ${path}`,
      )
    try {
      return await response.json()
    } catch {
      throw new Error(`Invalid JSON opening data: ${path}`)
    }
  }
  const library: OpeningLibrary = {
    catalog() {
      catalogPromise ??= json('catalog.json')
        .then(validateCatalog)
        .catch((error) => {
          catalogPromise = undefined
          throw error
        })
      return catalogPromise
    },
    family(id) {
      let pending = families.get(id)
      if (!pending) {
        pending = library
          .catalog()
          .then(async (catalog) => {
            const expected = catalog.families.find((family) => family.id === id)
            if (!expected) throw new Error(`Unknown opening family: ${id}`)
            return validateFamily(
              await json(`families/${encodeURIComponent(id)}.json`),
              expected,
            )
          })
          .catch((error) => {
            families.delete(id)
            throw error
          })
        families.set(id, pending)
      }
      return pending
    },
    async line(familyId, lineId) {
      return (
        (await library.family(familyId)).lines.find(
          (line) => line.id === lineId,
        ) ?? null
      )
    },
  }
  return library
}

export function createMemoryLibrary(
  catalog: Catalog,
  families: readonly Family[],
): OpeningLibrary {
  const savedCatalog = validateCatalog(structuredClone(catalog))
  const savedFamilies = new Map(
    families.map((family) => {
      const expected = savedCatalog.families.find(
        (summary) => summary.id === family.summary.id,
      )
      if (!expected)
        throw new Error(`Unknown opening family: ${family.summary.id}`)
      return [
        expected.id,
        validateFamily(structuredClone(family), expected),
      ] as const
    }),
  )
  return {
    async catalog() {
      return savedCatalog
    },
    async family(id) {
      const family = savedFamilies.get(id)
      if (!family) throw new Error(`Unknown opening family: ${id}`)
      return family
    },
    async line(familyId, lineId) {
      const family = savedFamilies.get(familyId)
      if (!family) throw new Error(`Unknown opening family: ${familyId}`)
      return family.lines.find((line) => line.id === lineId) ?? null
    },
  }
}

/** Exact SAN paths preserve repertoire context; transpositions are not merged. */
export function createRepertoire(lines: readonly OpeningLine[]): Repertoire {
  const saved = immutable(structuredClone(lines))
  const matching = (history: readonly string[]) =>
    saved.filter(
      (line) =>
        line.moves.length >= history.length &&
        history.every((move, index) => line.moves[index] === move),
    )
  return {
    matching,
    continuations(history) {
      return [
        ...new Set(
          matching(history).flatMap((line) =>
            line.moves[history.length] ? [line.moves[history.length]!] : [],
          ),
        ),
      ]
    },
    complete(history) {
      const candidates = matching(history)
      return (
        candidates.length > 0 &&
        candidates.every((line) => line.moves.length === history.length)
      )
    },
  }
}
