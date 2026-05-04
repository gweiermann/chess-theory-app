import type { Meta, StoryObj } from '@storybook/vue3'
import FamilyChildRow from './FamilyChildRow.vue'
import type { Line, TreeNode } from '~/domain/types'

const leafChild: TreeNode = {
  label: 'Two Knights Defense',
  lineId: 'two-knights',
  children: [],
}

const branchChild: TreeNode = {
  label: 'Classical Variation',
  children: [
    { label: 'Sub A', lineId: 'sub-a', children: [] },
    { label: 'Sub B', lineId: 'sub-b', children: [] },
  ],
}

const sampleLine: Line = {
  id: 'two-knights',
  eco: 'C55',
  fullName: 'Italian Game · Two Knights Defense',
  pgn: '',
  sanMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'],
  userSide: 'white',
}

const meta: Meta<typeof FamilyChildRow> = {
  title: 'Family/FamilyChildRow',
  component: FamilyChildRow,
  args: {
    child: leafChild,
    baseMastered: true,
    childMastered: false,
    childProgressLabel: '0 / 1',
    resolveLine: (id) => (id === 'two-knights' ? sampleLine : null),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const LeafUnlocked: Story = {}

export const LeafLockedByBase: Story = { args: { baseMastered: false } }

export const LeafMastered: Story = { args: { childMastered: true } }

export const Branch: Story = {
  args: { child: branchChild, childProgressLabel: '0 / 2' },
}

export const BranchLockedByBase: Story = {
  args: { child: branchChild, baseMastered: false, childProgressLabel: '0 / 2' },
}

export const BranchMastered: Story = {
  args: { child: branchChild, childMastered: true, childProgressLabel: '2 / 2' },
}
