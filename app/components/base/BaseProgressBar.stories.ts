import type { Meta, StoryObj } from '@storybook/vue3'
import BaseProgressBar from './BaseProgressBar.vue'

const meta: Meta<typeof BaseProgressBar> = {
  title: 'Base/BaseProgressBar',
  component: BaseProgressBar,
  args: { percent: 50, size: 'md' },
  argTypes: {
    percent: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = { args: { percent: 0 } }

export const Half: Story = { args: { percent: 50 } }

export const Full: Story = { args: { percent: 100 } }

export const Small: Story = { args: { size: 'sm' } }

export const ClampsOver100: Story = { args: { percent: 150 } }

export const ClampsBelowZero: Story = { args: { percent: -10 } }
