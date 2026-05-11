import type { Meta, StoryObj } from '@storybook/vue3'
import { h, ref, onMounted } from 'vue'
import type { BoardApi } from 'vue3-chessboard'
import ChessBoard from '~/components/ChessBoard.vue'
import PlayEmptyState from './PlayEmptyState.vue'
import PlayTopBar from './PlayTopBar.vue'
import PlayPhaseBar from './PlayPhaseBar.vue'
import PlayActionBar from './PlayActionBar.vue'
import PlayCompleteModal from './PlayCompleteModal.vue'
import BaseLoadingState from '~/components/base/BaseLoadingState.vue'
import BaseErrorAlert from '~/components/base/BaseErrorAlert.vue'
import { ITALIAN_GAME_OPENING, playMoves } from '../__fixtures__/chess-board'

const meta: Meta = {
  title: 'Pages/Learn – Play',
}

export default meta

type Story = StoryObj<typeof meta>

const TOP_BAR_ARGS = {
  topicLabel: 'e4',
  familyName: 'Italian Game',
  masteredCount: 2,
  totalLineCount: 12,
  lineHeading: 'Two Knights Defense',
  lineId: 'italian-main',
}

interface PageOptions {
  phaseLabel: string
  hintActive?: boolean
  hintDisabled?: boolean
  canGoBackward?: boolean
  canGoForward?: boolean
  driveBoard?: (api: BoardApi) => void
}

const renderFullPage = (options: PageOptions) => () =>
  h({
    setup() {
      const apiRef = ref<BoardApi | null>(null)

      const onReady = (api: BoardApi): void => {
        apiRef.value = api
        options.driveBoard?.(api)
      }

      onMounted(() => {
        if (apiRef.value) options.driveBoard?.(apiRef.value)
      })

      return () =>
        h(
          'div',
          { style: 'display:flex;flex-direction:column;min-height:100dvh;' },
          [
            h(PlayTopBar, { ...TOP_BAR_ARGS }),
            h(PlayPhaseBar, { label: options.phaseLabel }),
            h('div', { class: 'shrink-0' }, [
              h(ChessBoard, {
                orientation: 'white',
                playerColor: 'white',
                onReady,
              }),
            ]),
            h(PlayActionBar, {
              hintActive: options.hintActive ?? false,
              hintDisabled: options.hintDisabled ?? false,
              canGoBackward: options.canGoBackward ?? false,
              canGoForward: options.canGoForward ?? false,
            }),
          ],
        )
    },
  })

export const EmptyState: Story = {
  name: 'EmptyState – No Selection',
  render: () => () => h(PlayEmptyState),
}

export const LoadingState: Story = {
  name: 'LoadingState – Topic Loading',
  render: () => () =>
    h('div', { class: 'flex flex-1 items-center justify-center p-6' }, [
      h(BaseLoadingState, { message: 'Lade Thema…' }),
    ]),
}

export const ErrorState: Story = {
  name: 'ErrorState – Topic Load Failed',
  render: () => () =>
    h(BaseErrorAlert, { message: 'Thema konnte nicht geladen werden.', class: 'm-4' }),
}

export const IntroPhase: Story = {
  name: 'IntroPhase – Grundposition erreichen',
  render: renderFullPage({
    phaseLabel: 'Grundposition erreichen',
    hintActive: false,
    canGoBackward: false,
    canGoForward: false,
    driveBoard: (api) => {
      api.setConfig({ movable: { color: undefined } })
    },
  }),
}

export const BuildingPhase: Story = {
  name: 'BuildingPhase – Awaiting User Move',
  render: renderFullPage({
    phaseLabel: 'Aufbau · Schritt 3 von 5',
    hintActive: true,
    canGoBackward: true,
    canGoForward: false,
    driveBoard: (api) => {
      playMoves(api, ITALIAN_GAME_OPENING.slice(0, 4))
      window.requestAnimationFrame(() => {
        api.setShapes([{ orig: 'f1', dest: 'c4', brush: 'paleBlue' }])
      })
    },
  }),
}

export const RepetitionPhase: Story = {
  name: 'RepetitionPhase – Wiederholung 3/5',
  render: renderFullPage({
    phaseLabel: 'Wiederholung 3/5',
    hintActive: false,
    canGoBackward: true,
    canGoForward: false,
    driveBoard: (api) => {
      playMoves(api, ITALIAN_GAME_OPENING)
      api.setShapes([])
    },
  }),
}

export const DonePhase: Story = {
  name: 'DonePhase – Fertig',
  render: renderFullPage({
    phaseLabel: 'Fertig',
    hintActive: false,
    canGoBackward: false,
    canGoForward: false,
    driveBoard: (api) => {
      playMoves(api, ITALIAN_GAME_OPENING)
      api.setConfig({ movable: { color: undefined } })
      api.setShapes([])
    },
  }),
}

export const AllMastered: Story = {
  name: 'AllMastered – Complete Modal',
  render: () => () => h(PlayCompleteModal),
}
