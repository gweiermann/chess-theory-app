import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useFamilyNavigation } from '~/composables/useFamilyNavigation'
import type { Topic, TreeNode } from '~/domain/types'

const buildTopic = (): Topic => ({
  id: 'e4',
  firstMove: 'e4',
  label: 'e4',
  families: [
    {
      id: 'italian',
      name: 'Italian Game',
      category: 'opening',
      lines: [],
      tree: { label: 'Italian Game', children: [] },
    },
  ],
})

const buildRouter = () => ({
  push: vi.fn(),
})

const buildArgs = (overrides: { currentNodeLineId?: string } = {}) => {
  const router = buildRouter()
  const setSelection = vi.fn()
  const topic = ref<Topic | null>(buildTopic())
  const nav = useFamilyNavigation({
    topic,
    router: router as unknown as Parameters<typeof useFamilyNavigation>[0]['router'],
    setSelection,
    pathSegments: ref([]),
    topicId: ref('e4'),
    familyId: ref('italian'),
    currentNode: ref<TreeNode | null>({
      label: 'Italian Game',
      lineId: overrides.currentNodeLineId,
      children: [],
    }),
    nodeLineIds: ref(['line-a', 'line-b']),
  })
  return { nav, router, setSelection }
}

describe('useFamilyNavigation', () => {
  it('navigateInto pushes a query path that encodes each segment', () => {
    const { nav, router } = buildArgs()
    nav.navigateInto({ label: 'Two Knights', children: [] })
    expect(router.push).toHaveBeenCalledWith(
      '/openings/e4/family/italian?path=Two%20Knights',
    )
  })

  it('learnNode sets a node selection (with prefix line if present) and routes to play', () => {
    const { nav, router, setSelection } = buildArgs({ currentNodeLineId: 'base' })
    nav.learnNode()
    expect(setSelection).toHaveBeenCalledWith({
      topicId: 'e4',
      focus: { kind: 'node', lineIds: ['line-a', 'line-b'], prefixLineId: 'base' },
    })
    expect(router.push).toHaveBeenCalledWith('/learn/play')
  })

  it('learnNode is a no-op when there are no lines under the node', () => {
    const router = buildRouter()
    const setSelection = vi.fn()
    const nav = useFamilyNavigation({
      topic: ref<Topic | null>(buildTopic()),
      router: router as unknown as Parameters<typeof useFamilyNavigation>[0]['router'],
      setSelection,
      pathSegments: ref([]),
      topicId: ref('e4'),
      familyId: ref('italian'),
      currentNode: ref<TreeNode | null>(null),
      nodeLineIds: ref([]),
    })
    nav.learnNode()
    expect(setSelection).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('learnLine sets an exclusive line selection and routes to play', () => {
    const { nav, router, setSelection } = buildArgs()
    nav.learnLine('line-a')
    expect(setSelection).toHaveBeenCalledWith({
      topicId: 'e4',
      focus: { kind: 'line', lineId: 'line-a', exclusive: true },
    })
    expect(router.push).toHaveBeenCalledWith('/learn/play')
  })

  it('learnChildNode flattens the child subtree into a node selection', () => {
    const { nav, setSelection } = buildArgs()
    const child: TreeNode = {
      label: 'Branch',
      lineId: 'branch-base',
      children: [
        { label: 'Sub A', lineId: 'sub-a', children: [] },
        { label: 'Sub B', lineId: 'sub-b', children: [] },
      ],
    }
    nav.learnChildNode(child)
    expect(setSelection).toHaveBeenCalledWith({
      topicId: 'e4',
      focus: {
        kind: 'node',
        lineIds: ['branch-base', 'sub-a', 'sub-b'],
        prefixLineId: 'branch-base',
      },
    })
  })

  it('does nothing when topic is null', () => {
    const router = buildRouter()
    const setSelection = vi.fn()
    const nav = useFamilyNavigation({
      topic: ref<Topic | null>(null),
      router: router as unknown as Parameters<typeof useFamilyNavigation>[0]['router'],
      setSelection,
      pathSegments: ref([]),
      topicId: ref('e4'),
      familyId: ref('italian'),
      currentNode: ref<TreeNode | null>(null),
      nodeLineIds: ref(['x']),
    })
    nav.learnLine('x')
    nav.learnChildNode({ label: 'y', children: [] })
    expect(setSelection).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })
})
