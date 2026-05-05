import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import BaseErrorAlert from '~/components/base/BaseErrorAlert.vue'
import BaseLoadingState from '~/components/base/BaseLoadingState.vue'
import FamilyBaseLineCard from '~/components/family/FamilyBaseLineCard.vue'
import FamilyBreadcrumb from '~/components/family/FamilyBreadcrumb.vue'
import FamilyHeader from '~/components/family/FamilyHeader.vue'
import FamilyInfoBanner from '~/components/family/FamilyInfoBanner.vue'
import FamilyLockedActionDialog from '~/components/family/FamilyLockedActionDialog.vue'
import FamilyTreeList from '~/components/family/FamilyTreeList.vue'
import type { Line, TreeNode } from '~/domain/types'

const meta: Meta = { title: 'Pages/Openings – Family' }
export default meta
type Story = StoryObj<typeof meta>

const BASE_LINE: Line = {
  id: 'italian-main',
  eco: 'C50',
  fullName: 'Italian Game · Main Line',
  pgn: '',
  sanMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
  userSide: 'white',
}

const buildLeaf = (label: string, lineId: string): TreeNode => ({ label, lineId, children: [] })

const CHILDREN: TreeNode[] = [
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

const LINE_LOOKUP: Record<string, Line> = Object.fromEntries(
  ['anti-fried-liver', 'blackburne', 'classical-main', 'classical-sidelines', 'deutz'].map((id) => [
    id,
    { id, eco: 'C55', fullName: id, pgn: '', sanMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], userSide: 'white' } satisfies Line,
  ]),
)

const CRUMBS = [
  { label: 'e4', href: '/openings/e4' },
  { label: 'Italian Game', href: null },
]

const wrap = (children: ReturnType<typeof h>[]) =>
  h('div', { class: 'mx-auto w-full max-w-5xl px-4 py-6 sm:py-8' }, children)

export const Loading: Story = {
  render: () => () =>
    h('div', [
      wrap([
        h(FamilyBreadcrumb, { crumbs: CRUMBS }),
        h(BaseLoadingState, { message: 'Lade Eröffnung…' }),
      ]),
    ]),
}

export const Error: Story = {
  render: () => () =>
    h('div', [
      wrap([
        h(FamilyBreadcrumb, { crumbs: CRUMBS }),
        h(BaseErrorAlert, { message: 'Eröffnung konnte nicht geladen werden.' }),
      ]),
    ]),
}

export const Default: Story = {
  name: 'Default – Unlocked, Base Not Mastered',
  render: () => () =>
    h('div', [
      wrap([
        h(FamilyBreadcrumb, { crumbs: CRUMBS }),
        h(FamilyHeader, {
          label: 'Italian Game',
          masteredCount: 0,
          totalLines: 12,
          isNodeMastered: false,
          isRoot: true,
          introHint: null,
        }),
        h(FamilyBaseLineCard, { label: 'Italian Game', line: BASE_LINE, mastered: false }),
        h(FamilyInfoBanner, { baseLabel: 'Italian Game' }),
        h(FamilyTreeList, {
          children: CHILDREN,
          baseMastered: false,
          isChildMastered: () => false,
          childProgressLabel: (child: TreeNode) =>
            child.children.length === 0 ? '0 / 1' : `0 / ${child.children.length}`,
          resolveLine: (id: string) => LINE_LOOKUP[id] ?? null,
        }),
      ]),
      h(FamilyLockedActionDialog, {
        open: false,
        attemptedLabel: null,
        baseLineName: 'Italian Game',
      }),
    ]),
}

export const BaseMastered: Story = {
  name: 'BaseMastered – Variations Unlocked',
  render: () => () =>
    h('div', [
      wrap([
        h(FamilyBreadcrumb, { crumbs: CRUMBS }),
        h(FamilyHeader, {
          label: 'Italian Game',
          masteredCount: 3,
          totalLines: 12,
          isNodeMastered: false,
          isRoot: true,
          introHint: null,
        }),
        h(FamilyBaseLineCard, { label: 'Italian Game', line: BASE_LINE, mastered: true }),
        h(FamilyTreeList, {
          children: CHILDREN,
          baseMastered: true,
          isChildMastered: (child: TreeNode) => child.lineId === 'anti-fried-liver',
          childProgressLabel: (child: TreeNode) =>
            child.lineId === 'anti-fried-liver' ? '1 / 1' : child.children.length === 0 ? '0 / 1' : `0 / ${child.children.length}`,
          resolveLine: (id: string) => LINE_LOOKUP[id] ?? null,
        }),
      ]),
      h(FamilyLockedActionDialog, {
        open: false,
        attemptedLabel: null,
        baseLineName: 'Italian Game',
      }),
    ]),
}

export const WithLockedDialog: Story = {
  name: 'WithLockedDialog – Action Blocked',
  render: () => () =>
    h('div', [
      wrap([
        h(FamilyBreadcrumb, { crumbs: CRUMBS }),
        h(FamilyHeader, {
          label: 'Italian Game',
          masteredCount: 0,
          totalLines: 12,
          isNodeMastered: false,
          isRoot: true,
          introHint: null,
        }),
        h(FamilyBaseLineCard, { label: 'Italian Game', line: BASE_LINE, mastered: false }),
        h(FamilyInfoBanner, { baseLabel: 'Italian Game' }),
        h(FamilyTreeList, {
          children: CHILDREN,
          baseMastered: false,
          isChildMastered: () => false,
          childProgressLabel: (child: TreeNode) =>
            child.children.length === 0 ? '0 / 1' : `0 / ${child.children.length}`,
          resolveLine: (id: string) => LINE_LOOKUP[id] ?? null,
        }),
      ]),
      h(FamilyLockedActionDialog, {
        open: true,
        attemptedLabel: 'Two Knights Defense',
        baseLineName: 'Italian Game',
      }),
    ]),
}
