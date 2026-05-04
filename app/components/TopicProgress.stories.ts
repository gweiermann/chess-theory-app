import type { Meta, StoryObj } from '@storybook/vue3'
import TopicProgress from './TopicProgress.vue'

const meta: Meta<typeof TopicProgress> = {
  title: 'Existing/TopicProgress',
  component: TopicProgress,
  args: {
    mastered: 3,
    total: 8,
    size: 'md',
    unitLabel: 'Familien',
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = { args: { mastered: 0, total: 8 } }

export const Complete: Story = { args: { mastered: 8, total: 8 } }

export const Small: Story = { args: { size: 'sm' } }
