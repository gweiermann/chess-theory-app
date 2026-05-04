import type { Meta, StoryObj } from '@storybook/vue3'
import TopicFamilyCard from './TopicFamilyCard.vue'
import type { Family } from '~/domain/types'

const sampleFamily: Family = {
  id: 'italian',
  name: 'Italian Game',
  category: 'opening',
  lines: [
    {
      id: 'italian-main',
      eco: 'C50',
      fullName: 'Italian Game',
      pgn: '',
      sanMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
      userSide: 'white',
    },
  ],
  tree: { label: 'Italian Game', lineId: 'italian-main', children: [] },
}

const meta: Meta<typeof TopicFamilyCard> = {
  title: 'Topic/TopicFamilyCard',
  component: TopicFamilyCard,
  args: { family: sampleFamily, mastered: false },
}

export default meta

type Story = StoryObj<typeof meta>

export const Open: Story = {}

export const Mastered: Story = { args: { mastered: true } }

export const ManyLines: Story = {
  args: {
    family: {
      ...sampleFamily,
      name: 'Sicilian Defense',
      lines: Array.from({ length: 12 }).map((_, i) => ({
        ...sampleFamily.lines[0]!,
        id: `sicilian-${i}`,
      })),
    },
  },
}
