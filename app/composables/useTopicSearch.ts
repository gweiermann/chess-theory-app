import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { Family, FamilyCategory, Topic } from '~/domain/types'

export interface TopicSection {
  id: FamilyCategory
  label: string
  families: Family[]
}

interface UseTopicSearch {
  searchQuery: Ref<string>
  filteredFamilies: ComputedRef<Family[]>
  sections: ComputedRef<TopicSection[]>
  totalFiltered: ComputedRef<number>
}

const SECTION_LABEL: Record<FamilyCategory, string> = {
  opening: 'Eröffnungen',
  defense: 'Verteidigungen',
  gambit: 'Gambits',
}

const SECTION_ORDER: ReadonlyArray<FamilyCategory> = ['opening', 'defense', 'gambit']

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')

export const useTopicSearch = (topic: Ref<Topic | null>): UseTopicSearch => {
  const searchQuery = ref('')

  const filteredFamilies = computed<Family[]>(() => {
    const families = topic.value?.families ?? []
    const q = normalize(searchQuery.value.trim())
    if (q.length === 0) return families
    return families.filter((family) => {
      if (normalize(family.name).includes(q)) return true
      return family.lines.some((line) => normalize(line.fullName).includes(q))
    })
  })

  const sections = computed<TopicSection[]>(() => {
    const bucket: Record<FamilyCategory, Family[]> = {
      opening: [],
      defense: [],
      gambit: [],
    }
    for (const family of filteredFamilies.value) {
      bucket[family.category].push(family)
    }
    return SECTION_ORDER.map((id) => ({
      id,
      label: SECTION_LABEL[id],
      families: bucket[id],
    }))
  })

  const totalFiltered = computed(() =>
    sections.value.reduce((sum, s) => sum + s.families.length, 0),
  )

  return { searchQuery, filteredFamilies, sections, totalFiltered }
}
