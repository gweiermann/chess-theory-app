import type { Meta, StoryObj } from '@storybook/vue3'
import PlayTopBar from './PlayTopBar.vue'

const meta: Meta<typeof PlayTopBar> = {
  title: 'Play/PlayTopBar',
  component: PlayTopBar,
  args: {
    topicLabel: 'e4',
    familyName: 'Italian Game',
    masteredCount: 2,
    totalLineCount: 12,
    lineHeading: 'Two Knights Defense',
    lineId: 'two-knights',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoFamilyName: Story = { args: { familyName: null } }

export const LongHeading: Story = {
  args: {
    lineHeading: 'King’s Indian Defence: Sämisch Variation, Panno Variation, Main Line',
  },
}

export const ProgressEmpty: Story = { args: { masteredCount: 0 } }

export const ProgressComplete: Story = {
  args: { masteredCount: 12, totalLineCount: 12 },
}
