import type { Meta, StoryObj } from '@storybook/vue3'
import { h, ref, onMounted } from 'vue'
import type { BoardApi } from 'vue3-chessboard'
import ChessBoard from './ChessBoard.vue'
import { ITALIAN_GAME_OPENING, playMoves } from './__fixtures__/chess-board'

const meta: Meta<typeof ChessBoard> = {
  title: 'Existing/ChessBoard',
  component: ChessBoard,
  args: { orientation: 'white', playerColor: 'white' },
  argTypes: {
    orientation: { control: 'inline-radio', options: ['white', 'black'] },
    playerColor: { control: 'inline-radio', options: ['white', 'black'] },
  },
}

export default meta

type Story = StoryObj<typeof meta>

interface SceneOptions {
  /** Optional caption banner above the board. */
  caption?: string
}

const renderBoardScene = (
  args: Record<string, unknown>,
  drive: (api: BoardApi) => void,
  options: SceneOptions = {},
) => () =>
  h({
    setup() {
      const apiRef = ref<BoardApi | null>(null)
      const onReady = (api: BoardApi): void => {
        apiRef.value = api
        drive(api)
      }
      onMounted(() => {
        if (apiRef.value) drive(apiRef.value)
      })
      return () =>
        h(
          'div',
          { class: 'flex flex-col items-center gap-3' },
          [
            options.caption
              ? h(
                'p',
                {
                  class:
                      'text-sm font-medium text-(--ui-text-muted)',
                },
                options.caption,
              )
              : null,
            h(ChessBoard, {
              ...(args as object),
              onReady,
            }),
          ],
        )
    },
  })

export const Empty: Story = {}

export const IntroPhase: Story = {
  render: (args) =>
    renderBoardScene(
      args,
      (api) => {
        playMoves(api, ITALIAN_GAME_OPENING.slice(0, 4))
        api.setShapes([])
        api.setConfig({ movable: { color: undefined } })
      },
      { caption: 'Intro · Grundposition wird abgespielt' },
    )(),
}

export const BuildingPhaseAwaitingMove: Story = {
  name: 'BuildingPhase – AwaitingUserMove',
  render: (args) =>
    renderBoardScene(
      args,
      (api) => {
        playMoves(api, ITALIAN_GAME_OPENING.slice(0, 4))
        window.requestAnimationFrame(() => {
          api.setShapes([{ orig: 'f1', dest: 'c4', brush: 'paleBlue' }])
        })
      },
      { caption: 'Aufbau · Schritt 3 von 5 — Hint-Pfeil sichtbar' },
    )(),
}

export const BuildingPhaseCorrectFeedback: Story = {
  name: 'BuildingPhase – CorrectFeedback',
  render: (args) =>
    renderBoardScene(
      args,
      (api) => {
        playMoves(api, ITALIAN_GAME_OPENING.slice(0, 5))
        api.setShapes([])
      },
      { caption: 'Aufbau · Schritt 3 von 5 — korrekter Zug' },
    )(),
}

export const BuildingPhaseWrongFeedback: Story = {
  name: 'BuildingPhase – WrongFeedback',
  render: (args) =>
    renderBoardScene(
      args,
      (api) => {
        playMoves(api, ITALIAN_GAME_OPENING.slice(0, 4))
        window.requestAnimationFrame(() => {
          api.setShapes([{ orig: 'f1', dest: 'c4', brush: 'paleBlue' }])
        })
      },
      { caption: 'Aufbau · Schritt 3 von 5 — falscher Zug (Hint zurück)' },
    )(),
}

export const RepeatingPhaseRep3of5: Story = {
  name: 'RepeatingPhase – Rep3of5',
  render: (args) =>
    renderBoardScene(
      args,
      (api) => {
        playMoves(api, ITALIAN_GAME_OPENING)
        api.setShapes([])
      },
      { caption: 'Wiederholung 3/5 — vollständige Linie gespielt' },
    )(),
}

export const DonePhase: Story = {
  render: (args) =>
    renderBoardScene(
      args,
      (api) => {
        playMoves(api, ITALIAN_GAME_OPENING)
        api.setConfig({ movable: { color: undefined } })
      },
      { caption: 'Geschafft! Zugfolge gemeistert.' },
    )(),
}

export const BlackOrientation: Story = {
  args: { orientation: 'black', playerColor: 'black' },
  render: (args) =>
    renderBoardScene(
      args,
      (api) => {
        playMoves(api, ITALIAN_GAME_OPENING.slice(0, 4))
        window.requestAnimationFrame(() => {
          api.setShapes([{ orig: 'b8', dest: 'c6', brush: 'paleBlue' }])
        })
      },
      { caption: 'Schwarze Verteidigung — gespiegeltes Brett' },
    )(),
}
