import type { Meta, StoryObj } from '@storybook/vue3'
import FeedbackBanner from './FeedbackBanner.vue'

const meta: Meta<typeof FeedbackBanner> = {
  title: 'Play/FeedbackBanner',
  component: FeedbackBanner,
  args: { feedback: { kind: 'correct', played: 'Bc4' } },
}

export default meta

type Story = StoryObj<typeof meta>

export const Correct: Story = {
  args: { feedback: { kind: 'correct', played: 'Bc4' } },
}

export const Wrong: Story = {
  args: { feedback: { kind: 'wrong', played: 'Bb5', expected: 'Bc4' } },
}

export const NoFeedback: Story = {
  args: { feedback: null },
}
