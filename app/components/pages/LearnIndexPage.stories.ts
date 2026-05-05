import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import LearnIndexPageFixture from './LearnIndexPage.fixture.vue'

const meta: Meta = { title: 'Pages/Learn – Modus' }
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Default – Openings Selected',
  render: () => () => h(LearnIndexPageFixture, { selectedMode: 'openings' }),
}
