import type { Meta, StoryObj } from '@storybook/vue3'
import FamilyBreadcrumb from './FamilyBreadcrumb.vue'

const meta: Meta<typeof FamilyBreadcrumb> = {
  title: 'Family/FamilyBreadcrumb',
  component: FamilyBreadcrumb,
}

export default meta

type Story = StoryObj<typeof meta>

export const TopLevel: Story = {
  args: {
    crumbs: [
      { label: 'e4', href: '/openings/e4' },
      { label: 'Italian Game', href: null },
    ],
  },
}

export const TwoLevelDeep: Story = {
  args: {
    crumbs: [
      { label: 'e4', href: '/openings/e4' },
      { label: 'Italian Game', href: '/openings/e4/family/italian' },
      { label: 'Two Knights', href: null },
    ],
  },
}
