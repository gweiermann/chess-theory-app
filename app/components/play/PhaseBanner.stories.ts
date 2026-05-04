import type { Meta, StoryObj } from '@storybook/vue3'
import PhaseBanner from './PhaseBanner.vue'
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
  currentStep: 1,
  expectedMoveIndex: 0,
  repsDone: 0,
  expectedSan: 'e4',
  totalSteps: 5,
  prefixPlies: 0,
  ...overrides,
})

const meta: Meta<typeof PhaseBanner> = {
  title: 'Play/PhaseBanner',
  component: PhaseBanner,
  args: { line: sampleLine, state: buildState({}) },
}

export default meta

type Story = StoryObj<typeof meta>

export const IntroPhase: Story = {
  args: {
    state: buildState({
      phase: 'intro',
      expectedMoveIndex: 1,
      prefixPlies: 4,
      expectedSan: 'e5',
    }),
  },
}

export const BuildingPhaseEarly: Story = {
  args: {
    state: buildState({
      phase: 'building',
      currentStep: 1,
      totalSteps: 5,
      expectedSan: 'e4',
    }),
  },
}

export const BuildingPhaseMid: Story = {
  args: {
    state: buildState({
      phase: 'building',
      currentStep: 3,
      totalSteps: 5,
      expectedSan: 'Bc4',
    }),
  },
}

export const RepeatingPhaseRep1: Story = {
  args: {
    state: buildState({
      phase: 'repeating',
      repsDone: 0,
      expectedSan: 'e4',
    }),
  },
}

export const RepeatingPhaseRep3of5: Story = {
  args: {
    state: buildState({
      phase: 'repeating',
      repsDone: 3,
      expectedSan: 'Bc4',
    }),
  },
}

export const DonePhase: Story = {
  args: {
    state: buildState({ phase: 'done', expectedSan: null }),
  },
}
