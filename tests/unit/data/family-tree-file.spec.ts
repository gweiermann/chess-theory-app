import { describe, expect, it } from 'vitest'
import { buildDatasetFromTsv } from '~/domain/data/build-openings'
import { familyToTreeFile, treeFileToFamily } from '~/domain/data/family-tree-file'

describe('family tree wire format', () => {
  it('round-trips a real family from the dataset', () => {
    const tsv = [
      'eco\tname\tpgn',
      'C50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4',
      'C53\tItalian Game: Classical Variation\t1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5',
    ].join('\n')
    const ds = buildDatasetFromTsv(tsv)
    const fam = ds.topics.find((t) => t.id === 'e4')!.families.find((f) => f.id === 'italian-game')!

    const wire = familyToTreeFile(fam)
    expect(wire).not.toHaveProperty('lines')
    expect(wire).not.toHaveProperty('tree')
    expect(wire.children.length).toBeGreaterThan(0)

    const back = treeFileToFamily(wire)
    expect(back.id).toBe(fam.id)
    expect(back.lines).toEqual(fam.lines)
    expect(back.tree).toEqual(fam.tree)
  })
})
