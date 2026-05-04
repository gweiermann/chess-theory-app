import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import { flattenLineIdsInOrder } from '~/domain/tree'
import type { Topic, TreeNode } from '~/domain/types'
import type { CurrentSelection } from '~/infra/selection-repository'

interface UseFamilyNavigationArgs {
  topic: Ref<Topic | null>
  router: Router
  setSelection: (sel: CurrentSelection) => void
  pathSegments: Ref<string[]>
  topicId: Ref<string>
  familyId: Ref<string>
  currentNode: Ref<TreeNode | null>
  nodeLineIds: Ref<string[]>
}

export interface UseFamilyNavigation {
  navigateInto: (child: TreeNode) => void
  learnNode: () => void
  learnLine: (lineId: string) => void
  learnChildNode: (child: TreeNode) => void
}

export const useFamilyNavigation = ({
  topic,
  router,
  setSelection,
  pathSegments,
  topicId,
  familyId,
  currentNode,
  nodeLineIds,
}: UseFamilyNavigationArgs): UseFamilyNavigation => {
  const familyBasePath = (): string =>
    `/openings/${encodeURIComponent(topicId.value)}/family/${encodeURIComponent(familyId.value)}`

  const navigateInto = (child: TreeNode): void => {
    const newPath = [...pathSegments.value, child.label]
      .map(encodeURIComponent)
      .join('/')
    router.push(`${familyBasePath()}?path=${newPath}`)
  }

  const learnNode = (): void => {
    const t = topic.value
    if (!t || nodeLineIds.value.length === 0) return
    setSelection({
      topicId: t.id,
      focus: {
        kind: 'node',
        lineIds: nodeLineIds.value,
        prefixLineId: currentNode.value?.lineId,
      },
    })
    router.push('/learn/play')
  }

  const learnLine = (lineId: string): void => {
    const t = topic.value
    if (!t) return
    setSelection({
      topicId: t.id,
      focus: { kind: 'line', lineId, exclusive: true },
    })
    router.push('/learn/play')
  }

  const learnChildNode = (child: TreeNode): void => {
    const t = topic.value
    if (!t) return
    setSelection({
      topicId: t.id,
      focus: {
        kind: 'node',
        lineIds: flattenLineIdsInOrder(child),
        prefixLineId: child.lineId,
      },
    })
    router.push('/learn/play')
  }

  return { navigateInto, learnNode, learnLine, learnChildNode }
}
