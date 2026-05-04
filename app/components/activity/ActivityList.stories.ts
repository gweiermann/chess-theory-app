import type { Meta, StoryObj } from '@storybook/vue3'
import ActivityList from './ActivityList.vue'
import type { ResolvedActivityEntry } from '~/composables/useRecentActivity'

const buildEntry = (
  id: string,
  fullName: string,
  status: 'in_progress' | 'mastered',
  ago: number,
): ResolvedActivityEntry => ({
  topicId: 'e4',
  topicLabel: 'e4',
  lineId: id,
  familyName: 'Italian Game',
  status,
  lastPracticedAt: Date.now() - ago,
  line: {
    id,
    eco: 'C50',
    fullName,
    pgn: '',
    sanMoves: [],
    userSide: 'white',
  },
  stats: {
    repCount: 4,
    mistakeCount: 1,
    helpCount: 0,
    averageRepDurationMs: 7800,
    totalRepDurationMs: 31200,
    totalMoves: 16,
  },
} as ResolvedActivityEntry)

const meta: Meta<typeof ActivityList> = {
  title: 'Activity/ActivityList',
  component: ActivityList,
  args: {
    entries: [
      buildEntry('a', 'Italian Game · Main Line', 'in_progress', 5 * 60_000),
      buildEntry('b', 'Italian Game · Two Knights', 'mastered', 2 * 60 * 60_000),
      buildEntry('c', 'Bishop Opening · Berlin Defense', 'in_progress', 6 * 60 * 60_000),
    ],
    loading: false,
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const WithEntries: Story = {}

export const Loading: Story = { args: { entries: [], loading: true } }

export const Empty: Story = { args: { entries: [], loading: false } }
