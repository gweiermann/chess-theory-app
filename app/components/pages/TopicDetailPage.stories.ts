import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import BaseEmptyState from '~/components/base/BaseEmptyState.vue'
import BaseErrorAlert from '~/components/base/BaseErrorAlert.vue'
import BaseLoadingState from '~/components/base/BaseLoadingState.vue'
import TopicFamilyGrid from '~/components/topic/TopicFamilyGrid.vue'
import TopicHeader from '~/components/topic/TopicHeader.vue'
import TopicSearchBar from '~/components/topic/TopicSearchBar.vue'
import type { Family } from '~/domain/types'

const meta: Meta = { title: 'Pages/Openings – Topic' }
export default meta
type Story = StoryObj<typeof meta>

const buildFamily = (id: string, name: string, category: Family['category'], lineCount = 4): Family => ({
  id,
  name,
  category,
  lines: Array.from({ length: lineCount }).map((_, i) => ({
    id: `${id}-${i}`,
    eco: 'C50',
    fullName: `${name} · Line ${i + 1}`,
    pgn: '',
    sanMoves: ['e4'],
    userSide: 'white',
  })),
  tree: { label: name, lineId: `${id}-0`, children: [] },
})

const SECTIONS = [
  {
    id: 'opening',
    label: 'Eröffnungen',
    families: [
      buildFamily('italian', 'Italian Game', 'opening'),
      buildFamily('ruy', 'Ruy Lopez', 'opening', 12),
    ],
  },
  {
    id: 'defense',
    label: 'Verteidigungen',
    families: [buildFamily('sicilian', 'Sicilian Defense', 'defense', 26)],
  },
  {
    id: 'gambit',
    label: 'Gambits',
    families: [buildFamily('kings-gambit', "King's Gambit", 'gambit', 6)],
  },
]

const backLink = () =>
  h(
    'a',
    { class: 'mb-4 inline-flex items-center gap-1 text-sm text-(--ui-text-muted) sm:mb-6' },
    ['‹ Eröffnungen'],
  )

const wrap = (children: ReturnType<typeof h>[]) =>
  h('div', { class: 'mx-auto w-full max-w-5xl px-4 py-6 sm:py-8' }, children)

export const Loading: Story = {
  render: () => () =>
    wrap([
      backLink(),
      h(BaseLoadingState, { variant: 'skeleton', skeletonCount: 6, message: 'Lade Thema…' }),
    ]),
}

export const Error: Story = {
  render: () => () =>
    wrap([
      backLink(),
      h(BaseErrorAlert, { message: 'Thema konnte nicht geladen werden.' }),
    ]),
}

export const Default: Story = {
  name: 'Default – With Families',
  render: () => () =>
    wrap([
      backLink(),
      h(TopicHeader, {
        label: 'e4',
        totalFamilies: 8,
        totalLines: 42,
        masteredFamilies: 3,
        nextLine: null,
      }),
      h(TopicSearchBar, { modelValue: '', class: 'mb-6' }),
      h(TopicFamilyGrid, {
        sections: SECTIONS,
        isMastered: (f: Family) => f.id === 'italian',
      }),
    ]),
}

export const EmptySearch: Story = {
  name: 'EmptySearch – No Results',
  render: () => () =>
    wrap([
      backLink(),
      h(TopicHeader, {
        label: 'e4',
        totalFamilies: 8,
        totalLines: 42,
        masteredFamilies: 3,
        nextLine: null,
      }),
      h(TopicSearchBar, { modelValue: 'xyz', class: 'mb-6' }),
      h(BaseEmptyState, {
        icon: 'i-lucide-search-x',
        title: 'Keine Treffer',
        description: 'Keine Eröffnung gefunden für „xyz".',
      }),
    ]),
}
