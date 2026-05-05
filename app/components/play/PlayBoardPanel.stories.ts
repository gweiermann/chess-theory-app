import type { Meta, StoryObj } from '@storybook/vue3'
import PlayBoardPanel from './PlayBoardPanel.vue'

const meta: Meta<typeof PlayBoardPanel> = {
  title: 'Play/PlayBoardPanel',
  component: PlayBoardPanel,
  args: { orientation: 'white', playerColor: 'white' },
  argTypes: {
    orientation: { control: 'inline-radio', options: ['white', 'black'] },
    playerColor: { control: 'inline-radio', options: ['white', 'black'] },
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const White: Story = {}

export const BlackOrientation: Story = {
  args: { orientation: 'black', playerColor: 'black' },
}
