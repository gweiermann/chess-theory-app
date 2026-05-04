import type { Meta, StoryObj } from '@storybook/vue3'
import PlayActionSheet from './PlayActionSheet.vue'

const meta: Meta<typeof PlayActionSheet> = {
  title: 'Play/PlayActionSheet',
  component: PlayActionSheet,
  args: { open: true, canGoToPrevious: true },
}

export default meta

type Story = StoryObj<typeof meta>

export const Open: Story = {}

export const CannotGoToPrevious: Story = { args: { canGoToPrevious: false } }
