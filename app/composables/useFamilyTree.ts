import { computed, type ComputedRef, type Ref } from 'vue'
import { findNodeByPath, flattenLineIdsInOrder } from '~/domain/tree'
import type { Family, Line, Topic, TreeNode } from '~/domain/types'
import type { Crumb } from '~/components/family/FamilyBreadcrumb.vue'

interface UseFamilyTreeArgs {
  topic: Ref<Topic | null>
  topicId: Ref<string>
  familyId: Ref<string>
  pathSegments: Ref<string[]>
  isLineMastered: (lineId: string) => boolean
}

interface UseFamilyTree {
  family: ComputedRef<Family | null>
  currentNode: ComputedRef<TreeNode | null>
  nodeLineIds: ComputedRef<string[]>
  nodeMasteredCount: ComputedRef<number>
  isNodeMastered: ComputedRef<boolean>
  isBaseMastered: ComputedRef<boolean>
  baseLine: ComputedRef<Line | null>
  baseLineName: ComputedRef<string>
  breadcrumbs: ComputedRef<Crumb[]>
  childProgressLabel: (child: TreeNode) => string
  isChildMastered: (child: TreeNode) => boolean
  resolveLine: (lineId: string) => Line | null
}

export const useFamilyTree = ({
  topic,
  topicId,
  familyId,
  pathSegments,
  isLineMastered,
}: UseFamilyTreeArgs): UseFamilyTree => {
  const family = computed<Family | null>(
    () => topic.value?.families.find((f) => f.id === familyId.value) ?? null,
  )

  const currentNode = computed<TreeNode | null>(() => {
    const f = family.value
    if (!f) return null
    if (pathSegments.value.length === 0) return f.tree
    return findNodeByPath(f.tree, pathSegments.value)
  })

  const nodeLineIds = computed<string[]>(() => {
    const node = currentNode.value
    if (!node) return []
    return flattenLineIdsInOrder(node)
  })

  const nodeMasteredCount = computed(
    () => nodeLineIds.value.filter((id) => isLineMastered(id)).length,
  )

  const isNodeMastered = computed(
    () => nodeLineIds.value.length > 0 && nodeMasteredCount.value === nodeLineIds.value.length,
  )

  const resolveLine = (lineId: string): Line | null => {
    for (const f of topic.value?.families ?? []) {
      const line = f.lines.find((l) => l.id === lineId)
      if (line) return line
    }
    return null
  }

  const isBaseMastered = computed<boolean>(() => {
    const lineId = currentNode.value?.lineId
    if (!lineId) return true
    return isLineMastered(lineId)
  })

  const baseLine = computed<Line | null>(() => {
    const lineId = currentNode.value?.lineId
    if (!lineId) return null
    return resolveLine(lineId)
  })

  const baseLineName = computed(() =>
    baseLine.value?.fullName ?? currentNode.value?.label ?? '',
  )

  const breadcrumbs = computed<Crumb[]>(() => {
    const base = `/openings/${encodeURIComponent(topicId.value)}/family/${encodeURIComponent(familyId.value)}`
    const crumbs: Crumb[] = [
      {
        label: topic.value?.label ?? topicId.value,
        href: `/openings/${encodeURIComponent(topicId.value)}`,
      },
      {
        label: family.value?.name ?? familyId.value,
        href: pathSegments.value.length > 0 ? base : null,
      },
    ]
    for (let i = 0; i < pathSegments.value.length; i++) {
      const segPath = pathSegments.value
        .slice(0, i + 1)
        .map(encodeURIComponent)
        .join('/')
      const isLast = i === pathSegments.value.length - 1
      crumbs.push({
        label: pathSegments.value[i]!,
        href: isLast ? null : `${base}?path=${segPath}`,
      })
    }
    return crumbs
  })

  const childProgressLabel = (child: TreeNode): string => {
    const ids = flattenLineIdsInOrder(child)
    if (ids.length === 0) return ''
    const mastered = ids.filter((id) => isLineMastered(id)).length
    return `${mastered} / ${ids.length}`
  }

  const isChildMastered = (child: TreeNode): boolean => {
    const ids = flattenLineIdsInOrder(child)
    return ids.length > 0 && ids.every((id) => isLineMastered(id))
  }

  return {
    family,
    currentNode,
    nodeLineIds,
    nodeMasteredCount,
    isNodeMastered,
    isBaseMastered,
    baseLine,
    baseLineName,
    breadcrumbs,
    childProgressLabel,
    isChildMastered,
    resolveLine,
  }
}
