import type { Meta, StoryObj } from '@storybook/vue3'
import BaseLoadingState from './BaseLoadingState.vue'

const meta: Meta<typeof BaseLoadingState> = {
  title: 'Base/BaseLoadingState',
  component: BaseLoadingState,
  args: { message: 'Lade Daten…', variant: 'text', skeletonCount: 3 },
  argTypes: {
    variant: { control: 'inline-radio', options: ['text', 'skeleton'] },
    skeletonCount: { control: { type: 'number', min: 1, max: 10 } },
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const TextDefault: Story = {}

export const TextCustomMessage: Story = { args: { message: 'Lade Eröffnungen…' } }

export const Skeleton: Story = { args: { variant: 'skeleton' } }

export const SkeletonLong: Story = { args: { variant: 'skeleton', skeletonCount: 6 } }
