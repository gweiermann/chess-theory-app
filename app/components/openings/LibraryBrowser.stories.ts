import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import LibraryBrowser from './LibraryBrowser.vue'
import { createMemoryLibrary } from '../../modules/openings'
import type { Catalog, Family } from '../../modules/openings/public'

const italian: Family = {
  summary: { id: 'italian', name: 'Italian Game', topicId: 'e4', lineCount: 2 },
  lines: [
    {
      id: 'classical',
      familyId: 'italian',
      topicId: 'e4',
      name: 'Italian Game: Classical',
      eco: 'C50',
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
      suggestedSide: 'white',
    },
    {
      id: 'two-knights',
      familyId: 'italian',
      topicId: 'e4',
      name: 'Italian Game: Two Knights Defense',
      eco: 'C55',
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'],
      suggestedSide: 'black',
    },
  ],
}
const catalog: Catalog = {
  version: 1,
  revision: 'storybook-fixture',
  topics: [{ id: 'e4', name: 'King’s Pawn', familyCount: 1, lineCount: 2 }],
  families: [italian.summary],
  lineCount: 2,
}
const library = createMemoryLibrary(catalog, [italian])
const meta = {
  title: 'Openings/LibraryBrowser',
  component: LibraryBrowser,
  parameters: { layout: 'padded' },
  decorators: [
    () => ({
      template:
        '<div style="padding:24px;background:#f4f6f1;font-family:system-ui"><story /></div>',
    }),
  ],
  args: { catalog, library, side: 'white', progress: {}, onPractice: fn() },
} satisfies Meta<typeof LibraryBrowser>
export default meta
type Story = StoryObj<typeof meta>

export const Browse: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Nächste Variante lernen' }),
    )
    await expect(args.onPractice).toHaveBeenCalledWith({
      familyId: 'italian',
      lineId: 'classical',
      mode: 'guided',
    })
  },
}
export const LearnedVariations: Story = {
  args: {
    progress: {
      'white:classical': {
        lineId: 'classical',
        side: 'white',
        status: 'mastered',
        cleanRepetitions: 5,
        lastPracticedAt: 0,
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole('button', { name: /^Gelernt$/ }),
    )
    const row = await canvas.findByTestId('line-classical')
    await expect(within(row).getByText('Gelernt ✓')).toBeVisible()
    await userEvent.click(
      within(row).getByRole('button', {
        name: 'Wiederholen: Italian Game: Classical',
      }),
    )
    await expect(args.onPractice).toHaveBeenCalledWith({
      familyId: 'italian',
      lineId: 'classical',
      mode: 'review',
    })
  },
}
export const LoadFailure: Story = {
  args: {
    library: {
      ...library,
      family: async () => {
        throw new Error('Offline')
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('alert')).toBeVisible()
  },
}
