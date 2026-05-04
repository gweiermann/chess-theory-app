import { describe, expect, it } from 'vitest'
import { ref, shallowRef, triggerRef } from 'vue'
import { useFamilyTree } from '~/composables/useFamilyTree'
import type { Family, Topic, TreeNode } from '~/domain/types'

const buildLine = (
  id: string,
  fullName: string,
  sanMoves: string[] = ['e4'],
) => ({
  id,
  eco: 'C00',
  fullName,
  pgn: '',
  sanMoves,
  userSide: 'white' as const,
})

const buildFamily = (id: string, name: string, tree: TreeNode, lines = [buildLine(`${id}-base`, name)]): Family => ({
  id,
  name,
  category: 'opening',
  lines,
  tree,
})

const buildTopic = (families: Family[]): Topic => ({
  id: 'e4',
  firstMove: 'e4',
  label: 'e4',
  families,
})

describe('useFamilyTree', () => {
  it('returns the family pointed to by familyId', () => {
    const family = buildFamily('italian', 'Italian Game', {
      label: 'Italian Game',
      lineId: 'italian-base',
      children: [],
    })
    const topic = ref(buildTopic([family]))
    const { family: found } = useFamilyTree({
      topic,
      topicId: ref('e4'),
      familyId: ref('italian'),
      pathSegments: ref([]),
      isLineMastered: () => false,
    })
    expect(found.value?.id).toBe('italian')
  })

  it('builds breadcrumbs without trailing href on the active node', () => {
    const family = buildFamily('italian', 'Italian Game', {
      label: 'Italian Game',
      lineId: 'italian-base',
      children: [{ label: 'Two Knights', lineId: 'two-knights', children: [] }],
    }, [buildLine('italian-base', 'Italian Game'), buildLine('two-knights', 'Italian Game: Two Knights')])
    const topic = ref(buildTopic([family]))
    const { breadcrumbs } = useFamilyTree({
      topic,
      topicId: ref('e4'),
      familyId: ref('italian'),
      pathSegments: ref(['Two Knights']),
      isLineMastered: () => false,
    })
    expect(breadcrumbs.value).toHaveLength(3)
    expect(breadcrumbs.value[0]!.label).toBe('e4')
    expect(breadcrumbs.value[0]!.href).toBe('/openings/e4')
    expect(breadcrumbs.value[1]!.label).toBe('Italian Game')
    expect(breadcrumbs.value[1]!.href).toBe('/openings/e4/family/italian')
    expect(breadcrumbs.value[2]!.label).toBe('Two Knights')
    expect(breadcrumbs.value[2]!.href).toBeNull()
  })

  it('the family-level breadcrumb has no href when at the root path', () => {
    const family = buildFamily('italian', 'Italian Game', {
      label: 'Italian Game',
      lineId: 'italian-base',
      children: [],
    })
    const topic = ref(buildTopic([family]))
    const { breadcrumbs } = useFamilyTree({
      topic,
      topicId: ref('e4'),
      familyId: ref('italian'),
      pathSegments: ref([]),
      isLineMastered: () => false,
    })
    expect(breadcrumbs.value).toHaveLength(2)
    expect(breadcrumbs.value[1]!.href).toBeNull()
  })

  it('isBaseMastered reflects the current node’s own line', () => {
    const family = buildFamily('italian', 'Italian Game', {
      label: 'Italian Game',
      lineId: 'italian-base',
      children: [],
    })
    const topic = ref(buildTopic([family]))
    const masteredIds = shallowRef(new Set<string>())
    const { isBaseMastered } = useFamilyTree({
      topic,
      topicId: ref('e4'),
      familyId: ref('italian'),
      pathSegments: ref([]),
      isLineMastered: (id) => masteredIds.value.has(id),
    })
    expect(isBaseMastered.value).toBe(false)
    masteredIds.value = new Set(['italian-base'])
    triggerRef(masteredIds)
    expect(isBaseMastered.value).toBe(true)
  })

  it('isBaseMastered is true when the current node has no own lineId (purely structural)', () => {
    const family = buildFamily('italian', 'Italian Game', {
      label: 'Italian Game',
      children: [{ label: 'Variation', lineId: 'v', children: [] }],
    }, [buildLine('v', 'Variation')])
    const topic = ref(buildTopic([family]))
    const { isBaseMastered } = useFamilyTree({
      topic,
      topicId: ref('e4'),
      familyId: ref('italian'),
      pathSegments: ref([]),
      isLineMastered: () => false,
    })
    expect(isBaseMastered.value).toBe(true)
  })

  it('childProgressLabel reports mastered/total across the child subtree', () => {
    const family = buildFamily('italian', 'Italian Game', {
      label: 'Italian Game',
      lineId: 'italian-base',
      children: [
        {
          label: 'Two Knights',
          lineId: 'two-knights',
          children: [{ label: 'Sub', lineId: 'sub', children: [] }],
        },
      ],
    }, [
      buildLine('italian-base', 'Italian Game'),
      buildLine('two-knights', 'Two Knights'),
      buildLine('sub', 'Sub'),
    ])
    const topic = ref(buildTopic([family]))
    const { childProgressLabel } = useFamilyTree({
      topic,
      topicId: ref('e4'),
      familyId: ref('italian'),
      pathSegments: ref([]),
      isLineMastered: (id) => id === 'sub',
    })
    const child = topic.value!.families[0]!.tree.children[0]!
    expect(childProgressLabel(child)).toBe('1 / 2')
  })

  it('isChildMastered is true only when every line in the subtree is mastered', () => {
    const family = buildFamily('italian', 'Italian Game', {
      label: 'Italian Game',
      lineId: 'italian-base',
      children: [
        {
          label: 'Two Knights',
          lineId: 'two-knights',
          children: [],
        },
      ],
    }, [buildLine('italian-base', 'Italian Game'), buildLine('two-knights', 'Two Knights')])
    const topic = ref(buildTopic([family]))
    const masteredIds = new Set<string>()
    const { isChildMastered } = useFamilyTree({
      topic,
      topicId: ref('e4'),
      familyId: ref('italian'),
      pathSegments: ref([]),
      isLineMastered: (id) => masteredIds.has(id),
    })
    const child = topic.value!.families[0]!.tree.children[0]!
    expect(isChildMastered(child)).toBe(false)
    masteredIds.add('two-knights')
    expect(isChildMastered(child)).toBe(true)
  })

  it('resolveLine looks up a line across all families in the topic', () => {
    const otherFamily = buildFamily('caro', 'Caro-Kann', {
      label: 'Caro-Kann',
      lineId: 'caro-base',
      children: [],
    }, [buildLine('caro-base', 'Caro-Kann')])
    const topic = ref(buildTopic([
      buildFamily('italian', 'Italian Game', { label: 'Italian Game', lineId: 'italian-base', children: [] }),
      otherFamily,
    ]))
    const { resolveLine } = useFamilyTree({
      topic,
      topicId: ref('e4'),
      familyId: ref('italian'),
      pathSegments: ref([]),
      isLineMastered: () => false,
    })
    expect(resolveLine('caro-base')?.fullName).toBe('Caro-Kann')
    expect(resolveLine('does-not-exist')).toBeNull()
  })

  it('isNodeMastered requires every line under the current node to be mastered', () => {
    const family = buildFamily('italian', 'Italian Game', {
      label: 'Italian Game',
      lineId: 'italian-base',
      children: [{ label: 'Two Knights', lineId: 'two-knights', children: [] }],
    }, [buildLine('italian-base', 'Italian Game'), buildLine('two-knights', 'Two Knights')])
    const topic = ref(buildTopic([family]))
    const masteredIds = shallowRef(new Set<string>())
    const { isNodeMastered, nodeMasteredCount } = useFamilyTree({
      topic,
      topicId: ref('e4'),
      familyId: ref('italian'),
      pathSegments: ref([]),
      isLineMastered: (id) => masteredIds.value.has(id),
    })
    expect(nodeMasteredCount.value).toBe(0)
    expect(isNodeMastered.value).toBe(false)
    masteredIds.value = new Set(['italian-base'])
    triggerRef(masteredIds)
    expect(nodeMasteredCount.value).toBe(1)
    expect(isNodeMastered.value).toBe(false)
    masteredIds.value = new Set(['italian-base', 'two-knights'])
    triggerRef(masteredIds)
    expect(isNodeMastered.value).toBe(true)
  })

  it('returns null family/currentNode when topic is null', () => {
    const topic = ref(null as Topic | null)
    const { family, currentNode, nodeLineIds, isBaseMastered } = useFamilyTree({
      topic,
      topicId: ref('e4'),
      familyId: ref('italian'),
      pathSegments: ref([]),
      isLineMastered: () => false,
    })
    expect(family.value).toBeNull()
    expect(currentNode.value).toBeNull()
    expect(nodeLineIds.value).toEqual([])
    // No own line ⇒ structural; no gate to clear
    expect(isBaseMastered.value).toBe(true)
  })
})
