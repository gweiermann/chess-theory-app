import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import TrainingPanel from './TrainingPanel.vue'
import { createBoard } from '../../modules/board'
import type { TrainingSnapshot } from '../../modules/training'

const board = createBoard()
board.configureInput({ playerSide: 'white', input: 'player' })
const state: TrainingSnapshot = {
  status: 'player',
  phase: 'recall',
  mode: 'guided',
  side: 'white',
  line: {
    id: 'italian',
    eco: 'C50',
    name: 'Italian Game',
    familyId: 'italian',
    topicId: 'e4',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    suggestedSide: 'white',
  },
  expectedSan: 'e4',
  available: ['e4'],
  cleanRepetitions: 1,
  targetRepetitions: 5,
  round: 2,
  mistakes: 0,
  recalled: 0,
  assisted: 0,
  message: 'ready',
  newMaterial: false,
  persistenceError: null,
}
const meta = {
  title: 'Training/CompactPanel',
  component: TrainingPanel,
  parameters: { layout: 'fullscreen' },
  decorators: [
    () => ({
      template:
        '<div style="height:580px;max-width:374px;padding:8px;box-sizing:border-box;margin:auto;background:#f4f6f1"><story /></div>',
    }),
  ],
  args: {
    state,
    board: board.snapshot(),
    familyName: 'Italian Game',
    onHelp: fn(),
    onRestart: fn(),
    onNext: fn(),
    onMove: fn(),
    onRetrySave: fn(),
  },
} satisfies Meta<typeof TrainingPanel>
export default meta
type Story = StoryObj<typeof meta>

export const Recall: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Hilfe anzeigen' }),
    )
    await expect(args.onHelp).toHaveBeenCalled()
    await userEvent.click(canvas.getByTestId('square-e2'))
    await userEvent.click(canvas.getByTestId('square-e4'))
    await expect(args.onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4' })
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument()
  },
}
export const Retry: Story = {
  args: { state: { ...state, message: 'retry', mistakes: 1 } },
}
export const Completion: Story = {
  args: {
    state: {
      ...state,
      phase: 'complete',
      status: 'complete',
      cleanRepetitions: 5,
      message: 'complete',
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByTestId('round-complete')).toHaveTextContent(
      'gemeistert',
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Nächste Runde →' }),
    )
    await expect(args.onNext).toHaveBeenCalled()
  },
}
export const SaveFailure: Story = {
  args: { state: { ...state, persistenceError: 'Speicher nicht verfügbar' } },
}

const mistakeBoard = createBoard()
mistakeBoard.load({ moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'b5'] })
mistakeBoard.configureInput({ playerSide: 'white', input: 'player' })
export const Punish: Story = {
  args: {
    board: mistakeBoard.snapshot(),
    state: {
      ...state,
      mode: 'mistakes',
      phase: 'punish',
      message: 'punish',
      available: ['Bxb5'],
      expectedSan: 'Bxb5',
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByTestId('training-phase')).toHaveTextContent(
      'Fehler ausnutzen',
    )
    await expect(
      canvas.getByText('Theorie verlassen – nutze den Fehler.'),
    ).toBeVisible()
    await userEvent.click(canvas.getByTestId('square-c4'))
    await userEvent.click(canvas.getByTestId('square-b5'))
    await expect(args.onMove).toHaveBeenCalledWith({ from: 'c4', to: 'b5' })
    await expect(
      canvas.getByRole('button', { name: 'Anderen Weg zeigen' }),
    ).toBeDisabled()
  },
}
