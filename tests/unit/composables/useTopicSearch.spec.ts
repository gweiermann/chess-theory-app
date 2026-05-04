import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useTopicSearch } from '~/composables/useTopicSearch'
import type { Family, Topic } from '~/domain/types'

const buildFamily = (
  id: string,
  name: string,
  category: Family['category'],
  lineNames: string[] = [],
): Family => ({
  id,
  name,
  category,
  lines: lineNames.map((fullName, idx) => ({
    id: `${id}-${idx}`,
    eco: 'C00',
    fullName,
    pgn: '',
    sanMoves: [],
    userSide: 'white',
  })),
  tree: { label: name, lineId: null, children: [] },
})

const buildTopic = (families: Family[]): Topic => ({
  id: 'e4',
  label: 'e4',
  families,
})

describe('useTopicSearch', () => {
  it('returns all families when the query is empty', () => {
    const topic = ref(
      buildTopic([
        buildFamily('italian', 'Italian Game', 'opening'),
        buildFamily('sicilian', 'Sicilian Defense', 'defense'),
      ]),
    )
    const { sections, totalFiltered } = useTopicSearch(topic)
    expect(totalFiltered.value).toBe(2)
    const opening = sections.value.find((s) => s.id === 'opening')!
    expect(opening.families.map((f) => f.id)).toEqual(['italian'])
  })

  it('matches family names case-insensitively', () => {
    const topic = ref(
      buildTopic([
        buildFamily('italian', 'Italian Game', 'opening'),
        buildFamily('sicilian', 'Sicilian Defense', 'defense'),
      ]),
    )
    const { searchQuery, totalFiltered, sections } = useTopicSearch(topic)
    searchQuery.value = 'sicilian'
    expect(totalFiltered.value).toBe(1)
    expect(sections.value.find((s) => s.id === 'defense')!.families[0]!.id).toBe('sicilian')
  })

  it('matches by line name as a fallback', () => {
    const topic = ref(
      buildTopic([
        buildFamily('italian', 'Italian Game', 'opening', ['Two Knights Defence']),
      ]),
    )
    const { searchQuery, totalFiltered } = useTopicSearch(topic)
    searchQuery.value = 'two knights'
    expect(totalFiltered.value).toBe(1)
  })

  it('groups families into stable opening / defense / gambit buckets', () => {
    const topic = ref(
      buildTopic([
        buildFamily('king-gambit', 'King\'s Gambit', 'gambit'),
        buildFamily('caro', 'Caro-Kann', 'defense'),
        buildFamily('italian', 'Italian Game', 'opening'),
      ]),
    )
    const { sections } = useTopicSearch(topic)
    expect(sections.value.map((s) => s.id)).toEqual(['opening', 'defense', 'gambit'])
    expect(sections.value[0]!.families[0]!.id).toBe('italian')
    expect(sections.value[1]!.families[0]!.id).toBe('caro')
    expect(sections.value[2]!.families[0]!.id).toBe('king-gambit')
  })

  it('returns 0 totalFiltered when nothing matches', () => {
    const topic = ref(
      buildTopic([buildFamily('italian', 'Italian Game', 'opening')]),
    )
    const { searchQuery, totalFiltered } = useTopicSearch(topic)
    searchQuery.value = 'queen pawn'
    expect(totalFiltered.value).toBe(0)
  })

  it('handles a null topic without crashing', () => {
    const topic = ref(null as Topic | null)
    const { sections, totalFiltered } = useTopicSearch(topic)
    expect(totalFiltered.value).toBe(0)
    expect(sections.value).toHaveLength(3)
  })

  it('strips diacritics for normalization-aware matching', () => {
    const topic = ref(
      buildTopic([buildFamily('caro', 'Caro-Kann Verteidigung', 'defense')]),
    )
    const { searchQuery, totalFiltered } = useTopicSearch(topic)
    searchQuery.value = 'verteidigung'
    expect(totalFiltered.value).toBe(1)
  })
})
