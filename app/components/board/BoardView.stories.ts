import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import BoardView from './BoardView.vue'
import { createBoard } from '../../modules/board'
import type { BoardSnapshot } from '../../modules/board/public'
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import type { MoveInput } from '../../modules/board'

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
        '<div style="width:min(520px,calc(100vw - 32px));padding:16px;box-sizing:border-box;background:#102832"><story /></div>',
    }),
  ],
  args: { snapshot: fixture(), onMove: fn() },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof BoardView>
export default meta

type Story = StoryObj<typeof meta>
export const AnimatedMoves: Story = {
  render: (args) => ({
    components: { BoardView },
    setup() {
      const positions = {
        italian: {
          initialFen: undefined,
          moves: [
            'e4',
            'e5',
            'Nf3',
            'Nc6',
            'Bc4',
            'Bc5',
            'c3',
            'Nf6',
            'd4',
            'exd4',
            'cxd4',
            'Bb4+',
            'Nc3',
            'Nxe4',
            'O-O',
          ],
        },
        castling: {
          initialFen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
          moves: ['O-O'],
        },
        enPassant: {
          initialFen: '7k/8/8/3pP3/8/8/8/7K w - d6 0 1',
          moves: ['exd6'],
        },
        promotion: {
          initialFen: '7k/P7/8/8/8/8/8/7K w - - 0 1',
          moves: ['a8=Q+'],
        },
      }
      const scenario = ref<keyof typeof positions>('italian')
      const board = createBoard()
      board.configureInput({ input: 'player' })
      const snapshot = shallowRef(board.snapshot())
      const off = board.subscribe(() => {
        snapshot.value = board.snapshot()
      })
      onBeforeUnmount(() => {
        off()
        board.dispose()
      })
      return {
        snapshot,
        scenario,
        done: computed(
          () =>
            snapshot.value.moves.length >=
            positions[scenario.value].moves.length,
        ),
        next: () => {
          const san =
            positions[scenario.value].moves[snapshot.value.moves.length]
          if (san) board.makeMove(san)
        },
        reset: () =>
          board.load({
            initialFen: positions[scenario.value].initialFen,
            moves: [],
          }),
        move: (move: MoveInput) => {
          args.onMove?.(move)
          const result = board.proposeMove(move)
          if (result.status === 'proposed') board.acceptMove(result.attempt.id)
        },
      }
    },
    template: `<div><BoardView :snapshot="snapshot" @move="move" /><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;color:white"><select aria-label="Animationsstellung" v-model="scenario" @change="reset"><option value="italian">Italienisch</option><option value="castling">Rochade</option><option value="enPassant">En passant</option><option value="promotion">Umwandlung</option></select><button type="button" @click="next" :disabled="done">Zug abspielen</button><button type="button" @click="reset">Stellung zurücksetzen</button></div></div>`,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const settle = async () => {
      await Promise.all(
        canvasElement
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => {})),
      )
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Zug abspielen' }))
    await expect(canvas.getByTestId('square-e4')).toHaveAttribute(
      'data-piece',
      'p',
    )
    await settle()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Stellung zurücksetzen' }),
    )
    await settle()
    await expect(canvas.getByTestId('square-e2')).toHaveAttribute(
      'data-piece',
      'p',
    )
    for (const [scenario, destination] of [
      ['castling', 'g1'],
      ['enPassant', 'd6'],
      ['promotion', 'a8'],
    ]) {
      await userEvent.selectOptions(
        canvas.getByRole('combobox', { name: 'Animationsstellung' }),
        scenario!,
      )
      await settle()
      await userEvent.click(
        canvas.getByRole('button', { name: 'Zug abspielen' }),
      )
      const sprite = canvasElement.querySelector(
        `[data-piece-square="${destination}"]`,
      )!
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        await expect(
          sprite
            .getAnimations()
            .some((animation) => animation instanceof CSSTransition),
        ).toBe(true)
      await settle()
      if (scenario === 'castling')
        await expect(canvas.getByTestId('square-f1')).toHaveAttribute(
          'data-piece',
          'r',
        )
      if (scenario === 'enPassant')
        await expect(canvas.getByTestId('square-d5')).toHaveAttribute(
          'data-piece',
          '',
        )
      if (scenario === 'promotion')
        await expect(canvas.getByTestId('square-a8')).toHaveAttribute(
          'data-piece',
          'q',
        )
    }
  },
}
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
