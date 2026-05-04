import type { Meta, StoryObj } from '@storybook/vue3'
import PlayCompleteModal from './PlayCompleteModal.vue'

const meta: Meta<typeof PlayCompleteModal> = {
  title: 'Play/PlayCompleteModal',
  component: PlayCompleteModal,
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CustomCopy: Story = {
  args: {
    title: 'Tageschallenge geschafft',
    description: 'Du hast deine heutige Auswahl komplett gemeistert. Bis morgen!',
  },
}
