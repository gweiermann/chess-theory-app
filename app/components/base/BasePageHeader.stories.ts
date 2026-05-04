import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import BasePageHeader from './BasePageHeader.vue'

const meta: Meta<typeof BasePageHeader> = {
  title: 'Base/BasePageHeader',
  component: BasePageHeader,
  args: {
    eyebrow: 'Eröffnungen',
    title: 'Wähle eine Gruppe',
    description:
      'Tipp auf eine Gruppe, um die Eröffnungen zu sehen und gezielt eine Zugfolge auszuwählen, die du als Nächstes üben möchtest.',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutEyebrow: Story = { args: { eyebrow: undefined } }

export const WithoutDescription: Story = { args: { description: undefined } }

export const TitleOnly: Story = {
  args: { eyebrow: undefined, description: undefined, title: 'Profil' },
}

export const WithActions: Story = {
  render: (args) =>
    h(BasePageHeader, args, {
      actions: () =>
        h(
          'button',
          {
            class:
              'rounded-lg bg-(--ui-primary) px-3 py-1.5 text-sm font-medium text-white',
          },
          'Neu',
        ),
    }),
}
