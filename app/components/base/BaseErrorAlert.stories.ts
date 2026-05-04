import type { Meta, StoryObj } from '@storybook/vue3'
import BaseErrorAlert from './BaseErrorAlert.vue'

const meta: Meta<typeof BaseErrorAlert> = {
  title: 'Base/BaseErrorAlert',
  component: BaseErrorAlert,
  args: { message: 'Eröffnungen konnten nicht geladen werden.' },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithTitle: Story = {
  args: { title: 'Verbindung verloren', message: 'Bitte versuche es erneut.' },
}
