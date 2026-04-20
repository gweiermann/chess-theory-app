import { describe, expect, it } from 'vitest'
import { buildDatasetFromTsv, TOPIC_LABELS } from '~/domain/data/build-openings'

const tsv = [
  'eco\tname\tpgn',
  'C50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4',
  'C53\tItalian Game: Classical Variation\t1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5',
  'B00\tNimzowitsch Defense\t1. e4 Nc6',
  'D00\tQueen\'s Pawn Game\t1. d4',
  'A04\tZukertort Opening\t1. Nf3',
  'A00\tVan\'t Kruijs Opening\t1. e3',
].join('\n')

describe('buildDatasetFromTsv', () => {
  it('emits topics keyed by first move with descriptive labels', () => {
    const ds = buildDatasetFromTsv(tsv)
    const ids = ds.topics.map((t) => t.id)

    expect(ids).toContain('e4')
    expect(ids).toContain('d4')
    expect(ids).toContain('Nf3')
    expect(ids).toContain('other')

    const e4 = ds.topics.find((t) => t.id === 'e4')!
    expect(e4.label).toBe(TOPIC_LABELS.e4)
  })

  it('groups lines by family within each topic', () => {
    const ds = buildDatasetFromTsv(tsv)
    const e4 = ds.topics.find((t) => t.id === 'e4')!
    const familyNames = e4.families.map((f) => f.name).sort()

    expect(familyNames).toContain('Italian Game')
    expect(familyNames).toContain('Nimzowitsch Defense')

    const italian = e4.families.find((f) => f.name === 'Italian Game')!
    expect(italian.lines).toHaveLength(2)
    expect(italian.lines[0]!.fullName).toBe('Italian Game')
    expect(italian.lines[0]!.sanMoves).toEqual([
      'e4', 'e5', 'Nf3', 'Nc6', 'Bc4',
    ])
    expect(italian.tree.label).toBe('Italian Game')
  })

  it('skips header and blank lines, ignores comments', () => {
    const noisy = [
      'eco\tname\tpgn',
      '',
      '# this is a comment',
      'C50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4',
    ].join('\n')

    const ds = buildDatasetFromTsv(noisy)
    expect(ds.topics).toHaveLength(1)
    expect(ds.topics[0]!.families[0]!.lines).toHaveLength(1)
  })

  it('puts lines whose first move is not a known topic into "other"', () => {
    const ds = buildDatasetFromTsv(tsv)
    const other = ds.topics.find((t) => t.id === 'other')!
    expect(other).toBeDefined()
    expect(other.label).toBe(TOPIC_LABELS.other)
    expect(other.families.flatMap((f) => f.lines).map((l) => l.fullName))
      .toContain("Van't Kruijs Opening")
  })

  it('assigns deterministic ids to every line', () => {
    const ds = buildDatasetFromTsv(tsv)
    const allIds = ds.topics
      .flatMap((t) => t.families)
      .flatMap((f) => f.lines)
      .map((l) => l.id)

    expect(new Set(allIds).size).toBe(allIds.length)
    expect(allIds.every((id) => id.length > 0)).toBe(true)
  })

  it('stamps generatedAt with an ISO timestamp', () => {
    const ds = buildDatasetFromTsv(tsv)
    expect(() => new Date(ds.generatedAt).toISOString()).not.toThrow()
  })
})
