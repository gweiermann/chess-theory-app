import type { Meta, StoryObj } from '@storybook/vue3'
import BaseIconAction from './BaseIconAction.vue'

const meta: Meta<typeof BaseIconAction> = {
  title: 'Base/BaseIconAction',
  component: BaseIconAction,
  args: {
    icon: 'i-lucide-help-circle',
    label: 'Hilfe',
    emphasis: 'secondary',
    disabled: false,
  },
  argTypes: {
    emphasis: { control: 'inline-radio', options: ['primary', 'secondary'] },
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Secondary: Story = {}

export const Primary: Story = {
  args: { icon: 'i-lucide-eye', label: 'Tipp anzeigen', emphasis: 'primary' },
}

export const Disabled: Story = { args: { disabled: true } }
