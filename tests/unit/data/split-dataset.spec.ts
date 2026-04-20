import { describe, expect, it } from 'vitest'
import { buildDatasetFromTsv } from '~/domain/data/build-openings'
import { splitDataset } from '~/domain/data/split-dataset'

const tsv = [
  'eco\tname\tpgn',
  'C50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4',
  'C53\tItalian Game: Classical Variation\t1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5',
  'B00\tNimzowitsch Defense\t1. e4 Nc6',
  'D00\tQueen\'s Pawn Game\t1. d4',
  'A04\tZukertort Opening\t1. Nf3',
  'A00\tVan\'t Kruijs Opening\t1. e3',
].join('\n')

describe('splitDataset', () => {
  it('produces an index with topic summaries plus per-topic payloads', () => {
    const ds = buildDatasetFromTsv(tsv)
    const split = splitDataset(ds)

    expect(split.index.generatedAt).toBe(ds.generatedAt)
    expect(split.index.topics).toHaveLength(ds.topics.length)

    const e4Summary = split.index.topics.find((t) => t.id === 'e4')!
    expect(e4Summary.label).toBe('1.e4')
    expect(e4Summary.firstMove).toBe('e4')
    expect(e4Summary.totalFamilies).toBe(2)
    expect(e4Summary.totalLines).toBe(3)
    expect(e4Summary.familyIds).toEqual(['italian-game', 'nimzowitsch-defense'])
  })

  it('keeps the full topic payload addressable by topic id', () => {
    const ds = buildDatasetFromTsv(tsv)
    const split = splitDataset(ds)

    const e4 = split.topics.get('e4')!
    expect(e4).toBeDefined()
    expect(e4.id).toBe('e4')
    expect(e4.families.map((f) => f.name).sort()).toEqual([
      'Italian Game',
      'Nimzowitsch Defense',
    ])
    expect(
      e4.families.flatMap((f) => f.lines.map((l) => l.fullName)),
    ).toEqual([
      'Italian Game',
      'Italian Game: Classical Variation',
      'Nimzowitsch Defense',
    ])
  })

  it('always includes every topic from the source dataset', () => {
    const ds = buildDatasetFromTsv(tsv)
    const split = splitDataset(ds)
    for (const topic of ds.topics) {
      expect(split.topics.has(topic.id)).toBe(true)
    }
  })
})
