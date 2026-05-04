import type { Meta, StoryObj } from '@storybook/vue3'
import FamilyInfoBanner from './FamilyInfoBanner.vue'

const meta: Meta<typeof FamilyInfoBanner> = {
  title: 'Family/FamilyInfoBanner',
  component: FamilyInfoBanner,
  args: { baseLabel: 'Italian Game' },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LongLabel: Story = {
  args: { baseLabel: 'King\'s Indian Defence: Sämisch Variation, Panno Variation, Main Line' },
}
