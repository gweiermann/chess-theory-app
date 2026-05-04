import type { Meta, StoryObj } from '@storybook/vue3'
import TopicHeader from './TopicHeader.vue'
import type { Line } from '~/domain/types'

const sampleLine: Line = {
  id: 'italian-main',
  eco: 'C50',
  fullName: 'Italian Game · Main Line',
  pgn: '',
  sanMoves: ['e4'],
  userSide: 'white',
}

const meta: Meta<typeof TopicHeader> = {
  title: 'Topic/TopicHeader',
  component: TopicHeader,
  args: {
    label: 'e4',
    totalFamilies: 12,
    totalLines: 64,
    masteredFamilies: 3,
    nextLine: sampleLine,
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NothingMastered: Story = { args: { masteredFamilies: 0 } }

export const AllMastered: Story = {
  args: { masteredFamilies: 12, nextLine: null },
}
