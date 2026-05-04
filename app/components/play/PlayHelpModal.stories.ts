import type { Meta, StoryObj } from '@storybook/vue3'
import PlayHelpModal from './PlayHelpModal.vue'
import type { SessionState } from '~/domain/session'
import type { Line } from '~/domain/types'

const sampleLine: Line = {
  id: 'italian-main',
  eco: 'C50',
  fullName: 'Italian Game · Main Line',
  pgn: '',
  sanMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
  userSide: 'white',
}

const buildState = (overrides: Partial<SessionState>): SessionState => ({
  line: sampleLine,
  phase: 'building',
  currentStep: 2,
  expectedMoveIndex: 2,
  repsDone: 0,
  expectedSan: 'Nf3',
  totalSteps: 5,
  prefixPlies: 0,
  ...overrides,
})

const meta: Meta<typeof PlayHelpModal> = {
  title: 'Play/PlayHelpModal',
  component: PlayHelpModal,
  args: {
    open: true,
    line: sampleLine,
    state: buildState({}),
    lastFeedback: null,
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Building: Story = {}

export const AfterCorrect: Story = {
  args: { lastFeedback: { kind: 'correct', played: 'Nf3' } },
}

export const AfterWrong: Story = {
  args: { lastFeedback: { kind: 'wrong', played: 'Bb5', expected: 'Bc4' } },
}
