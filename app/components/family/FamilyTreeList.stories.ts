import type { Meta, StoryObj } from '@storybook/vue3'
import FamilyTreeList from './FamilyTreeList.vue'
import type { Line, TreeNode } from '~/domain/types'

const buildLeaf = (label: string, lineId: string): TreeNode => ({
  label,
  lineId,
  children: [],
})

const branchChildren: TreeNode[] = [
  buildLeaf('Anti-Fried Liver Defense', 'anti-fried-liver'),
  buildLeaf('Blackburne-Kostić Gambit', 'blackburne'),
  {
    label: 'Classical Variation',
    children: [
      buildLeaf('Main Line', 'classical-main'),
      buildLeaf('Sidelines', 'classical-sidelines'),
    ],
  },
  buildLeaf('Deutz Gambit', 'deutz'),
]

const lineLookup: Record<string, Line> = Object.fromEntries(
  branchChildren
    .flatMap((c) => (c.children.length > 0 ? c.children : [c]))
    .filter((c): c is TreeNode & { lineId: string } => !!c.lineId)
    .map((c) => [
      c.lineId,
      {
        id: c.lineId,
        eco: 'C55',
        fullName: c.label,
        pgn: '',
        sanMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'],
        userSide: 'white',
      },
    ]),
)

const meta: Meta<typeof FamilyTreeList> = {
  title: 'Family/FamilyTreeList',
  component: FamilyTreeList,
  args: {
    children: branchChildren,
    baseMastered: true,
    isChildMastered: () => false,
    childProgressLabel: (child) =>
      child.children.length === 0 ? '0 / 1' : `0 / ${child.children.length}`,
    resolveLine: (id) => lineLookup[id] ?? null,
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const BaseUnlocked: Story = {}

export const BaseLocked: Story = { args: { baseMastered: false } }

export const SomeMastered: Story = {
  args: {
    isChildMastered: (child) =>
      child.lineId === 'anti-fried-liver' || child.label === 'Classical Variation',
    childProgressLabel: (child) =>
      child.children.length === 0
        ? '1 / 1'
        : `${child.children.length} / ${child.children.length}`,
  },
}
