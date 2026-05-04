import type { Meta, StoryObj } from '@storybook/vue3'
import PlayEmptyState from './PlayEmptyState.vue'

const meta: Meta<typeof PlayEmptyState> = {
  title: 'Play/PlayEmptyState',
  component: PlayEmptyState,
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
