import type { Meta, StoryObj } from '@storybook/vue3'
import BaseSelectableCard from './BaseSelectableCard.vue'

const meta: Meta<typeof BaseSelectableCard> = {
  title: 'Base/BaseSelectableCard',
  component: BaseSelectableCard,
  args: {
    icon: 'i-lucide-book-open',
    title: 'Eröffnungen lernen',
    description: 'Übe Schritt für Schritt ausgewählte Zugfolgen aus deiner Eröffnungsbibliothek.',
    selected: false,
    disabled: false,
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Selected: Story = { args: { selected: true } }

export const DisabledWithBadge: Story = {
  args: {
    icon: 'i-lucide-shuffle',
    title: 'Zufallsmodus',
    description: 'Teste dein Gedächtnis mit zufällig ausgewählten Eröffnungen aus allen Themen.',
    badge: 'Demnächst',
    disabled: true,
  },
}

export const TitleOnly: Story = {
  args: { description: undefined, title: 'Schnell üben' },
}
