import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import SettingsPanel from './SettingsPanel.vue'
import { DEFAULT_SETTINGS } from '../../modules/shared'
import type { LearningOutcome } from '../../modules/shared'

const activity: LearningOutcome[] = [
  {
    id: 'story-round',
    kind: 'round',
    at: 1791367200000,
    lineId: 'italian-classical',
    familyId: 'italian',
    side: 'white',
    mode: 'guided',
    positionKey: 'start',
    move: 'e4',
    grade: 'recalled',
    mistakes: 0,
    completed: true,
    cleanRepetitions: 5,
    datasetRevision: 'storybook',
  },
]
const meta = {
  title: 'Learning/SettingsPanel',
  component: SettingsPanel,
  parameters: { layout: 'padded' },
  decorators: [
    () => ({
      template:
        '<div style="padding:24px;background:#f4f6f1;font-family:system-ui"><story /></div>',
    }),
  ],
  args: {
    settings: { ...DEFAULT_SETTINGS },
    activity: [],
    progress: {},
    saving: false,
    onSave: fn(),
    onResume: fn(),
  },
} satisfies Meta<typeof SettingsPanel>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}
export const RecentPractice: Story = {
  args: {
    activity,
    lineNames: { 'italian-classical': 'Italian Game: Classical Variation' },
    progress: {
      'white:italian-classical': {
        lineId: 'italian-classical',
        side: 'white',
        status: 'mastered',
        cleanRepetitions: 5,
        lastPracticedAt: 1791367200000,
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Erneut üben: Italian Game: Classical Variation mit Weiß',
      }),
    )
    await expect(args.onResume).toHaveBeenCalledWith({
      familyId: 'italian',
      lineId: 'italian-classical',
      side: 'white',
      mode: 'guided',
    })
  },
}
export const AdjustTraining: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const repetitions = canvas.getByRole('spinbutton', {
      name: 'Sichere Wiederholungen',
    })
    await userEvent.clear(repetitions)
    await userEvent.type(repetitions, '3')
    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'Bevorzugte Seite' }),
      'black',
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Einstellungen speichern' }),
    )
    await expect(args.onSave).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      repetitions: 3,
      side: 'black',
    })
  },
}
export const InvalidRepetitions: Story = {
  args: { settings: { ...DEFAULT_SETTINGS, repetitions: 0 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: 'Einstellungen speichern' }),
    ).toBeDisabled()
  },
}
export const Saving: Story = { args: { saving: true } }
