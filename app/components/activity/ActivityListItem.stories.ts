import type { Meta, StoryObj } from '@storybook/vue3'
import ActivityListItem from './ActivityListItem.vue'
import type { ResolvedActivityEntry } from '~/composables/useRecentActivity'

const baseEntry: ResolvedActivityEntry = {
  topicId: 'e4',
  topicLabel: 'e4',
  lineId: 'italian-main',
  familyName: 'Italian Game',
  status: 'in_progress',
  lastPracticedAt: Date.now() - 12 * 60 * 1000,
  line: {
    id: 'italian-main',
    eco: 'C50',
    fullName: 'Italian Game · Main Line',
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
} as ResolvedActivityEntry

const meta: Meta<typeof ActivityListItem> = {
  title: 'Activity/ActivityListItem',
  component: ActivityListItem,
  args: { entry: baseEntry },
}

export default meta

type Story = StoryObj<typeof meta>

export const InProgress: Story = {}

export const Mastered: Story = {
  args: { entry: { ...baseEntry, status: 'mastered' } },
}

export const WithHelpCount: Story = {
  args: {
    entry: { ...baseEntry, stats: { ...baseEntry.stats, helpCount: 2 } },
  },
}

export const LineUnavailable: Story = {
  args: { entry: { ...baseEntry, line: null } },
}

export const RecentlyPracticed: Story = {
  args: { entry: { ...baseEntry, lastPracticedAt: Date.now() - 30_000 } },
}

export const PracticedHoursAgo: Story = {
  args: {
    entry: { ...baseEntry, lastPracticedAt: Date.now() - 5 * 60 * 60 * 1000 },
  },
}
