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
const french: Family = {
  summary: {
    id: 'french',
    name: 'French Defense',
    topicId: 'e4',
    lineCount: 1,
  },
  lines: [
    {
      id: 'advance',
      familyId: 'french',
      topicId: 'e4',
      name: 'French Defense: Advance Variation',
      eco: 'C02',
      moves: ['e4', 'e6', 'd4', 'd5', 'e5'],
      suggestedSide: 'black',
    },
  ],
}
const catalog: Catalog = {
  version: 1,
  revision: 'storybook-fixture',
  topics: [{ id: 'e4', name: 'King’s Pawn', familyCount: 2, lineCount: 3 }],
  families: [italian.summary, french.summary],
  lineCount: 3,
}
const library = createMemoryLibrary(catalog, [italian, french])
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

export const Browse: Story = {}
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
    await userEvent.click(canvas.getByTestId('family-italian'))
    const row = await canvas.findByTestId('line-classical')
    await expect(within(row).getByText('Gelernt')).toBeVisible()
    await userEvent.click(
      within(row).getByRole('button', {
        name: 'Sparring: Italian Game: Classical',
      }),
    )
    await expect(args.onPractice).toHaveBeenCalledWith({
      familyId: 'italian',
      lineId: 'classical',
      mode: 'sparring',
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
    await userEvent.click(canvas.getByTestId('family-italian'))
    await expect(await canvas.findByRole('alert')).toBeVisible()
  },
}
