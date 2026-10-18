import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import BoardView from './BoardView.vue'
import { createBoard } from '../../modules/board'
import type { BoardSnapshot } from '../../modules/board/public'

function fixture(
  configure?: (board: ReturnType<typeof createBoard>) => void,
): BoardSnapshot {
  const board = createBoard()
  board.configureInput({ input: 'player' })
  configure?.(board)
  return board.snapshot()
}
const meta = {
  title: 'Board/BoardView',
  component: BoardView,
  decorators: [
    () => ({
      template:
        '<div style="max-width:520px;padding:16px;background:#102832"><story /></div>',
    }),
  ],
  args: { snapshot: fixture(), onMove: fn() },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof BoardView>
export default meta

type Story = StoryObj<typeof meta>
export const White: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByTestId('square-e2'))
    await expect(canvas.getByTestId('square-e2')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(canvas.getByTestId('square-e4'))
    await expect(args.onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4' })
  },
}
export const Black: Story = {
  args: {
    snapshot: fixture((board) => {
      board.configureInput({ playerSide: 'black', orientation: 'black' })
      board.makeMove('e4')
    }),
  },
}
export const Help: Story = {
  args: {
    snapshot: fixture((board) => {
      board.showArrows([{ from: 'e2', to: 'e4', purpose: 'solution' }])
    }),
  },
}
export const Exploration: Story = {
  args: {
    snapshot: fixture((board) => {
      board.load({ moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'] })
      board.showArrows([{ from: 'c2', to: 'c3', purpose: 'exploration' }])
    }),
  },
}
export const Locked: Story = {
  args: {
    snapshot: fixture((board) => {
      board.configureInput({ input: 'disabled' })
    }),
  },
}
export const Promotion: Story = {
  args: {
    snapshot: fixture((board) => {
      board.load({ initialFen: '7k/P7/8/8/8/8/8/7K w - - 0 1', moves: [] })
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByTestId('square-a7'))
    await userEvent.click(canvas.getByTestId('square-a8'))
    await expect(
      canvas.getByRole('group', { name: 'Bauernumwandlung' }),
    ).toBeVisible()
  },
}
export const Premove: Story = {
  args: {
    snapshot: fixture((board) => {
      board.configureInput({ input: 'premove' })
      board.makeMove('e4')
      board.proposeMove({ from: 'g1', to: 'f3' })
    }),
  },
}
export const QueuedSequence: Story = {
  args: {
    snapshot: fixture((board) => {
      board.configureInput({ input: 'premove' })
      board.makeMove('e4')
      board.proposeMove({ from: 'g1', to: 'f3' })
      board.proposeMove({ from: 'f1', to: 'c4' })
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByTestId('square-f3')).toHaveClass('queued')
    await expect(canvas.getByTestId('square-c4')).toHaveClass('queued')
    await expect(
      within(canvas.getByTestId('square-f3')).getByText('1'),
    ).toBeVisible()
    await expect(
      within(canvas.getByTestId('square-c4')).getByText('2'),
    ).toBeVisible()
  },
}

export const TouchDrag: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const source = canvas.getByTestId('square-e2')
    const destination = canvas.getByTestId('square-e4')
    const from = source.getBoundingClientRect(),
      to = destination.getBoundingClientRect()
    await userEvent.pointer([
      {
        keys: '[TouchA>]',
        target: source,
        coords: {
          clientX: from.left + from.width / 2,
          clientY: from.top + from.height / 2,
        },
      },
      {
        pointerName: 'TouchA',
        target: destination,
        coords: {
          clientX: to.left + to.width / 2,
          clientY: to.top + to.height / 2,
        },
      },
      {
        keys: '[/TouchA]',
        target: destination,
        coords: {
          clientX: to.left + to.width / 2,
          clientY: to.top + to.height / 2,
        },
      },
    ])
    await expect(args.onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4' })
  },
}
