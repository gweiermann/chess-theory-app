import type { Meta, StoryObj } from '@storybook/vue3'
import FamilyBaseLineCard from './FamilyBaseLineCard.vue'
import type { Line } from '~/domain/types'

const sampleLine: Line = {
  id: 'italian-base',
  eco: 'C50',
  fullName: 'Italian Game',
  pgn: '',
  sanMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
  userSide: 'white',
}

const meta: Meta<typeof FamilyBaseLineCard> = {
  title: 'Family/FamilyBaseLineCard',
  component: FamilyBaseLineCard,
  args: { label: 'Italian Game', line: sampleLine, mastered: false },
}

export default meta

type Story = StoryObj<typeof meta>

export const NotYetMastered: Story = {}

export const Mastered: Story = { args: { mastered: true } }

export const NoLineMetadata: Story = { args: { line: null } }
