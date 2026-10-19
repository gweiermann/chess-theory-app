import { describe, expect, it } from 'vitest'
import {
  parseSource,
  selectCourse,
  buildOpenings,
} from '../../scripts/build-openings'
import {
  createMemoryLibrary,
  createRepertoire,
  createOpeningLibrary,
} from '../../app/modules/openings'
import type { Catalog, Family } from '../../app/modules/shared'
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'

const lines = parseSource(
  'eco\tname\tpgn\nC50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4\nC50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5',
  'fixture',
)
const family: Family = {
  summary: {
    id: lines[0]!.familyId,
    name: 'Italian Game',
    topicId: 'e4',
    lineCount: 2,
  },
  lines,
}
const catalog: Catalog = {
  version: 1,
  revision: 'fixture',
  lineCount: 2,
  topics: [{ id: 'e4', name: 'King’s Pawn', familyCount: 1, lineCount: 2 }],
  families: [family.summary],
}

describe('opening source preservation', () => {
  it('builds identical course revisions from LF and CRLF checkouts', async () => {
    const cache = resolve('.cache')
    await mkdir(cache, { recursive: true })
    const root = await mkdtemp(resolve(cache, 'opening-line-endings-'))
    try {
      const results = []
      for (const newline of ['\n', '\r\n']) {
        const source = resolve(root, 'data/source')
        await mkdir(source, { recursive: true })
        for (const letter of ['a', 'b', 'c', 'd', 'e'])
          await writeFile(
            resolve(source, `${letter}.tsv`),
            [
              'eco\tname\tpgn',
              ...(letter === 'c'
                ? ['C50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4']
                : []),
              '',
            ].join(newline),
          )
        await buildOpenings(root)
        results.push(
          await readFile(resolve(root, 'public/data/catalog.json'), 'utf8'),
        )
      }
      expect(results[0]).toBe(results[1])
    } finally {
      if (dirname(root) === cache)
        await rm(root, { recursive: true, force: true })
    }
  })
  it('derives course membership from its shortest source anchor, regardless of variation names', () => {
    const records = parseSource(
      [
        'eco\tname\tpgn',
        'C50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5',
        'C50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4',
        'C56\tItalian Game: Scotch Gambit\t1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Bc4',
        'C44\tScotch Game: Transposed position\t1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 exd4',
      ].join('\n'),
      'fixture',
    )
    const original = structuredClone(records)
    const course = selectCourse(records, 'Italian Game')
    expect(course.summary.lineCount).toBe(3)
    expect(course.lines.map((line) => line.id)).toEqual([
      records[0]!.id,
      records[1]!.id,
      records[3]!.id,
    ])
    expect(course.lines[2]).toEqual({
      ...records[3],
      familyId: records[1]!.familyId,
    })
    expect(
      selectCourse([...records].reverse(), 'Italian Game')
        .lines.map((line) => line.id)
        .sort(),
    ).toEqual(course.lines.map((line) => line.id).sort())
    expect(records).toEqual(original)
  })
  it('fails explicitly when a course has no unique shortest source anchor', () => {
    expect(() => selectCourse(lines, 'Unknown Opening')).toThrow(
      'Missing course anchor',
    )
    const ambiguous = parseSource(
      'eco\tname\tpgn\nC00\tExample\t1. e4 e5\nB00\tExample\t1. e4 c5',
      'fixture',
    )
    expect(() => selectCourse(ambiguous, 'Example')).toThrow(
      'Ambiguous course anchor',
    )
    expect(
      selectCourse(
        [...lines, { ...lines[0]!, id: 'duplicate' }],
        'Italian Game',
      ).lines,
    ).toHaveLength(3)
  })
  it('preserves variations sharing a display name with different moves', () => {
    const records = parseSource(
      'eco\tname\tpgn\nC00\tFrench Defense\t1. e4 e6\nC00\tFrench Defense\t1. e4 e6 2. d4 d5',
      'fixture',
    )
    expect(records).toHaveLength(2)
    expect(records[0]!.id).not.toBe(records[1]!.id)
    expect(records[1]!.moves).toEqual(['e4', 'e6', 'd4', 'd5'])
  })
  it('rejects illegal source moves with the source location', () => {
    expect(() =>
      parseSource('eco\tname\tpgn\nC50\tItalian Game\t1. e5', 'fixture'),
    ).toThrow('fixture:2: invalid PGN')
  })
  it('continues past an exact short line when a longer variation is available', () => {
    const repertoire = createRepertoire(lines)
    expect(repertoire.complete(lines[0]!.moves)).toBe(false)
    expect(repertoire.continuations(lines[0]!.moves)).toEqual(['Bc5'])
    expect(repertoire.complete(lines[1]!.moves)).toBe(true)
    expect(repertoire.matching(['d4'])).toEqual([])
    expect(repertoire.complete(['d4'])).toBe(false)
  })
  it('loads just the requested family, sharing in-flight requests', async () => {
    const paths: string[] = []
    const library = createOpeningLibrary({
      fetch: async (url) => {
        paths.push(String(url))
        return new Response(
          JSON.stringify(
            String(url).endsWith('catalog.json') ? catalog : family,
          ),
        )
      },
    })
    await library.catalog()
    const [first, second] = await Promise.all([
      library.family(family.summary.id),
      library.family(family.summary.id),
    ])
    expect(first).toBe(second)
    expect(paths).toEqual([
      '/data/catalog.json',
      `/data/families/${family.summary.id}.json`,
    ])
    expect(Object.isFrozen(first.lines[0]!.moves)).toBe(true)
  })
  it('does not treat an HTML fallback as a library', async () => {
    const library = createOpeningLibrary({
      fetch: async () => new Response('<html>not a dataset</html>'),
    })
    await expect(library.catalog()).rejects.toThrow('Invalid JSON')
  })
  it('rejects corrupted nested moves before publishing a family', async () => {
    const corrupt = {
      ...family,
      lines: [{ ...lines[0], moves: ['e5'] }, lines[1]],
    }
    const library = createOpeningLibrary({
      fetch: async (url) =>
        new Response(
          JSON.stringify(
            String(url).endsWith('catalog.json') ? catalog : corrupt,
          ),
        ),
    })
    await expect(library.family(family.summary.id)).rejects.toThrow(
      'Invalid opening line',
    )
  })
  it('memory adapter returns isolated immutable data and finds a line', async () => {
    const library = createMemoryLibrary(catalog, [family])
    expect(await library.line(family.summary.id, lines[1]!.id)).toEqual(
      lines[1],
    )
    expect(await library.line(family.summary.id, 'absent')).toBeNull()
  })
  it('delivers every Italian move-order descendant with original identities and names', async () => {
    const sources = await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map(async (name) =>
        parseSource(
          await readFile(resolve(`data/source/${name}.tsv`), 'utf8'),
          `${name}.tsv`,
        ),
      ),
    )
    const sourceLines = sources.flat()
    expect(sourceLines).toHaveLength(3865)
    expect(new Set(sourceLines.map((line) => line.id)).size).toBe(3865)
    expect(
      sourceLines.filter((line) => line.name.split(':')[0] === 'Italian Game'),
    ).toHaveLength(187)
    const delivered = JSON.parse(
      await readFile(resolve('public/data/catalog.json'), 'utf8'),
    ) as Catalog
    expect(delivered.lineCount).toBe(184)
    expect(delivered.families.map((family) => family.name)).toEqual([
      'Italian Game',
    ])
    const records = await Promise.all(
      delivered.families.map(async (summary) => {
        const content = JSON.parse(
          await readFile(
            resolve(`public/data/families/${summary.id}.json`),
            'utf8',
          ),
        ) as Family
        expect(content.lines).toHaveLength(summary.lineCount)
        return content.lines
      }),
    )
    expect(
      records
        .flat()
        .map((line) => line.id)
        .sort(),
    ).toEqual(
      sourceLines
        .filter((line) =>
          ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'].every(
            (move, index) => line.moves[index] === move,
          ),
        )
        .map((line) => line.id)
        .sort(),
    )
    for (const line of records.flat()) {
      const original = sourceLines.find((source) => source.id === line.id)!
      expect(line.name).toBe(original.name)
      expect(line.moves).toEqual(original.moves)
      expect(line.familyId).toBe(delivered.families[0]!.id)
    }
  }, 20000)
  it('allows retry after a failed request instead of caching failure permanently', async () => {
    let calls = 0
    const library = createOpeningLibrary({
      fetch: async () =>
        ++calls === 1
          ? new Response('unavailable', { status: 503 })
          : new Response(JSON.stringify(catalog)),
    })
    await expect(library.catalog()).rejects.toThrow('503')
    expect(await library.catalog()).toEqual(catalog)
    expect(calls).toBe(2)
  })
})
