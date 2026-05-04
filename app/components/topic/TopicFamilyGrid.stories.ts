import type { Meta, StoryObj } from '@storybook/vue3'
import TopicFamilyGrid from './TopicFamilyGrid.vue'
import type { Family } from '~/domain/types'

const buildFamily = (
  id: string,
  name: string,
  category: Family['category'],
  lineCount = 4,
): Family => ({
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

const meta: Meta<typeof TopicFamilyGrid> = {
  title: 'Topic/TopicFamilyGrid',
  component: TopicFamilyGrid,
  args: {
    sections: [
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
        families: [buildFamily('kings-gambit', 'King\'s Gambit', 'gambit', 6)],
      },
    ],
    isMastered: () => false,
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SomeMastered: Story = {
  args: { isMastered: (family) => family.id === 'italian' },
}

export const OnlyOpenings: Story = {
  args: {
    sections: [
      {
        id: 'opening',
        label: 'Eröffnungen',
        families: [buildFamily('italian', 'Italian Game', 'opening')],
      },
      { id: 'defense', label: 'Verteidigungen', families: [] },
      { id: 'gambit', label: 'Gambits', families: [] },
    ],
  },
}
