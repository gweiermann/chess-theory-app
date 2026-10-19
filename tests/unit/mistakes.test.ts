import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createMistakeBook } from '../../app/modules/mistakes'
import { parseSource } from '../../scripts/build-openings'
import type { Family } from '../../app/modules/shared'
import type { MistakeDataset } from '../../app/modules/mistakes'

const lines = parseSource(
  'eco\tname\tpgn\nC50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3',
  'fixture',
)
const family: Family = {
  summary: {
    id: lines[0]!.familyId,
    name: 'Italian Game',
    topicId: 'e4',
    lineCount: 1,
  },
  lines,
}
const history = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']
const dataset: MistakeDataset = {
  version: 1,
  revision: 'a'.repeat(64),
  openingRevision: 'opening',
  engine: {
    name: 'Stockfish fixture',
    sha256: 'b'.repeat(64),
    source: 'fixture',
    threads: 1,
    hashMb: 32,
  },
  policy: {
    screenNodes: 60000,
    verifyNodes: 250000,
    minimumLossCp: 150,
    minimumAdvantageCp: 100,
    maximumPlayerMoves: 3,
    responseToleranceCp: 35,
  },
  coverage: { positions: 3, analyzed: 3, terminalPositions: 1 },
  branches: [
    {
      id: 'fault',
      history,
      mistake: 'Nd4',
      lossCp: 200,
      advantageCp: 150,
      paths: [{ moves: ['Nxe5', 'd6', 'Nf3'], advantageCp: 140 }],
    },
  ],
}
describe('verified mistake book', () => {
  it('validates the generated Stockfish artifact and its content and opening revisions', async () => {
    const family: Family = JSON.parse(
      await readFile('public/data/families/italian-game-a79f8e15.json', 'utf8'),
    )
    const catalog = JSON.parse(
      await readFile('public/data/catalog.json', 'utf8'),
    )
    const data: MistakeDataset = JSON.parse(
      await readFile('public/data/mistakes/italian-game-a79f8e15.json', 'utf8'),
    )
    const { revision, ...content } = data
    expect(
      createHash('sha256').update(JSON.stringify(content)).digest('hex'),
    ).toBe(revision)
    const book = createMistakeBook(data, family, catalog.revision)
    expect(data.branches.length).toBeGreaterThan(100)
    expect(data.coverage.analyzed).toBe(data.coverage.positions)
    expect(
      new Set(
        data.branches.flatMap((branch) =>
          branch.paths.map((path) => Math.ceil(path.moves.length / 2)),
        ),
      ),
    ).toEqual(new Set([1, 2, 3]))
    for (const branch of data.branches) {
      const side = branch.history.length % 2 === 0 ? 'black' : 'white'
      expect(book.at(branch.history, side)).toContainEqual(branch)
    }
  }, 20000)
  it('matches exact opponent histories and keeps solutions immutable', () => {
    const book = createMistakeBook(dataset, family, 'opening')
    expect(book.at(history, 'white').map((branch) => branch.id)).toEqual([
      'fault',
    ])
    expect(book.at(history, 'black')).toEqual([])
    expect(book.at([...history, 'Bc5'], 'white')).toEqual([])
    expect(Object.isFrozen(book.get('fault')!.paths[0]!.moves)).toBe(true)
  })
  it('rejects stale analysis, harmless deviations, illegal answers and theory moves', () => {
    expect(() => createMistakeBook(dataset, family, 'changed')).toThrow()
    for (const change of [
      { lossCp: 10 },
      { advantageCp: -10 },
      { mistake: 'Bc5' },
      { paths: [{ moves: ['e5'], advantageCp: 150 }] },
      { history: ['d4', 'd5'] },
      { paths: [{ moves: ['Nxe5'], advantageCp: 0 }] },
    ])
      expect(() =>
        createMistakeBook(
          { ...dataset, branches: [{ ...dataset.branches[0], ...change }] },
          family,
          'opening',
        ),
      ).toThrow()
  })
})
