import type { Meta, StoryObj } from '@storybook/vue3'
import BaseStatPill from './BaseStatPill.vue'

const meta: Meta<typeof BaseStatPill> = {
  title: 'Base/BaseStatPill',
  component: BaseStatPill,
  args: { label: 'Versuche', value: 12, icon: 'i-lucide-target' },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutIcon: Story = { args: { icon: undefined } }

export const NumericValue: Story = { args: { label: 'Mastered', value: 5 } }

export const Percentage: Story = {
  args: { label: 'Quote', value: '92%', icon: 'i-lucide-trophy' },
}
