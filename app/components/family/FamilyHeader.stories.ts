import type { Meta, StoryObj } from '@storybook/vue3'
import FamilyHeader from './FamilyHeader.vue'

const meta: Meta<typeof FamilyHeader> = {
  title: 'Family/FamilyHeader',
  component: FamilyHeader,
  args: {
    label: 'Italian Game',
    masteredCount: 0,
    totalLines: 12,
    isNodeMastered: false,
    isRoot: true,
    introHint: null,
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Root: Story = {}

export const SubVariation: Story = {
  args: { label: 'Two Knights Defense', isRoot: false, totalLines: 6 },
}

export const WithIntroHint: Story = {
  args: { introHint: 'Startet mit der Grundvariante „Italian Game“' },
}

export const NodeMastered: Story = {
  args: {
    masteredCount: 12,
    isNodeMastered: true,
  },
}
