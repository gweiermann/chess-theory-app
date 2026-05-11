import type { Meta, StoryObj } from '@storybook/vue3'
import PlayActionBar from './PlayActionBar.vue'

const meta: Meta<typeof PlayActionBar> = {
  title: 'Play/PlayActionBar',
  component: PlayActionBar,
  args: {
    hintActive: false,
    hintDisabled: false,
    canGoBackward: true,
    canGoForward: true,
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const HintActive: Story = { args: { hintActive: true } }

export const HintStructurallyDisabled: Story = {
  args: { hintActive: false, hintDisabled: true },
}

export const ReplayPinnedToStart: Story = {
  args: { canGoBackward: false, canGoForward: true },
}

export const ReplayAtLatest: Story = {
  args: { canGoBackward: true, canGoForward: false },
}
