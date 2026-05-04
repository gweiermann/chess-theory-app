import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import BaseEmptyState from './BaseEmptyState.vue'

const meta: Meta<typeof BaseEmptyState> = {
  title: 'Base/BaseEmptyState',
  component: BaseEmptyState,
  args: {
    icon: 'i-lucide-inbox',
    title: 'Noch keine Aktivität',
    description: 'Sobald du eine Zugfolge übst, taucht sie hier auf.',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutDescription: Story = { args: { description: undefined } }

export const WithAction: Story = {
  render: (args) =>
    h(BaseEmptyState, args, {
      actions: () =>
        h(
          'button',
          {
            class:
              'rounded-lg bg-(--ui-primary) px-4 py-2 text-sm font-medium text-white',
          },
          'Jetzt üben',
        ),
    }),
}
