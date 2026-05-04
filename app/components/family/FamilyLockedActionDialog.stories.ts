import type { Meta, StoryObj } from '@storybook/vue3'
import FamilyLockedActionDialog from './FamilyLockedActionDialog.vue'

const meta: Meta<typeof FamilyLockedActionDialog> = {
  title: 'Family/FamilyLockedActionDialog',
  component: FamilyLockedActionDialog,
  args: {
    open: true,
    attemptedLabel: 'Two Knights Defense',
    baseLineName: 'Italian Game',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LongLabels: Story = {
  args: {
    attemptedLabel: 'Anti-Marshall Variation, Smyslov System',
    baseLineName: 'Ruy Lopez · Closed Variation',
  },
}
