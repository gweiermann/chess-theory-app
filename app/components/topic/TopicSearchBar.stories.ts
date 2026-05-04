import type { Meta, StoryObj } from '@storybook/vue3'
import TopicSearchBar from './TopicSearchBar.vue'

const meta: Meta<typeof TopicSearchBar> = {
  title: 'Topic/TopicSearchBar',
  component: TopicSearchBar,
  args: { modelValue: '' },
}

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const WithQuery: Story = { args: { modelValue: 'sicilian' } }

export const CustomPlaceholder: Story = {
  args: { placeholder: 'Suche nach Familie oder Linie…' },
}
