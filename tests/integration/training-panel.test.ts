import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import TrainingPanel from '../../app/components/training/TrainingPanel.vue'
import { createBoard } from '../../app/modules/board'
import type { TrainingSnapshot } from '../../app/modules/training'

it('offers board interaction without a user-facing move-command bridge', async () => {
  const board = createBoard()
  board.configureInput({ input: 'player' })
  const state: TrainingSnapshot = {
    status: 'player',
    phase: 'recall',
    mode: 'guided',
    side: 'white',
    line: {
      id: 'italian',
      familyId: 'italian',
      topicId: 'e4',
      eco: 'C50',
      name: 'Italian Game',
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
      suggestedSide: 'white',
    },
    expectedSan: 'e4',
    available: ['e4'],
    cleanRepetitions: 0,
    targetRepetitions: 5,
    round: 1,
    mistakes: 0,
    recalled: 0,
    assisted: 0,
    message: 'ready',
    newMaterial: false,
    persistenceError: null,
  }
  const view = mount(TrainingPanel, {
    props: { state, board: board.snapshot(), familyName: 'Italian Game' },
  })
  expect(view.find('input').exists()).toBe(false)
  await view.get('button[aria-label="e2 Weiß Bauer"]').trigger('click')
  await view.get('button[aria-label="e4 leer"]').trigger('click')
  expect(view.emitted('move')).toEqual([[{ from: 'e2', to: 'e4' }]])
  view.unmount()
  board.dispose()
})
