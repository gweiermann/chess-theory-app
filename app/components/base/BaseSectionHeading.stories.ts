import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import BaseSectionHeading from './BaseSectionHeading.vue'

const meta: Meta<typeof BaseSectionHeading> = {
  title: 'Base/BaseSectionHeading',
  component: BaseSectionHeading,
  args: { title: 'Familien' },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithEyebrow: Story = {
  args: { eyebrow: 'Übersicht', title: 'Eröffnungen' },
}

export const WithActions: Story = {
  render: (args) =>
    h(BaseSectionHeading, args, {
      actions: () =>
        h(
          'a',
          { class: 'text-sm text-(--ui-primary) hover:underline', href: '#' },
          'Alle anzeigen',
        ),
    }),
}

export const AsH3: Story = { args: { title: 'Sub', as: 'h3' } }
