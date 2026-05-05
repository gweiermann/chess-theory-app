import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import BasePageHeader from '~/components/base/BasePageHeader.vue'
import ActivityList from '~/components/activity/ActivityList.vue'
import type { ResolvedActivityEntry } from '~/composables/useRecentActivity'

const meta: Meta = { title: 'Pages/Profile – Activity' }
export default meta
type Story = StoryObj<typeof meta>

const HEADER_PROPS = {
  eyebrow: 'Profil · Aktivität',
  title: 'Zuletzt geübt',
  description: 'Wechsle schnell zwischen den Zugfolgen, an denen du zuletzt gearbeitet hast.',
}

const buildEntry = (
  id: string,
  fullName: string,
  status: 'in_progress' | 'mastered',
  ago: number,
): ResolvedActivityEntry =>
  ({
    topicId: 'e4',
    topicLabel: 'e4',
    lineId: id,
    familyName: 'Italian Game',
    status,
    lastPracticedAt: Date.now() - ago,
    line: { id, eco: 'C50', fullName, pgn: '', sanMoves: [], userSide: 'white' },
    stats: { repCount: 4, mistakeCount: 1, helpCount: 0, averageRepDurationMs: 7800, totalRepDurationMs: 31200, totalMoves: 16 },
  }) as ResolvedActivityEntry

const ENTRIES = [
  buildEntry('a', 'Italian Game · Main Line', 'in_progress', 5 * 60_000),
  buildEntry('b', 'Italian Game · Two Knights', 'mastered', 2 * 60 * 60_000),
  buildEntry('c', 'Bishop Opening · Berlin Defense', 'in_progress', 6 * 60 * 60_000),
]

const wrap = (children: ReturnType<typeof h>[]) =>
  h('div', { class: 'mx-auto w-full max-w-3xl px-4 py-6 sm:py-8' }, children)

export const WithEntries: Story = {
  render: () => () =>
    wrap([
      h(BasePageHeader, HEADER_PROPS),
      h(ActivityList, { entries: ENTRIES, loading: false }),
    ]),
}

export const Loading: Story = {
  render: () => () =>
    wrap([
      h(BasePageHeader, HEADER_PROPS),
      h(ActivityList, { entries: [], loading: true }),
    ]),
}

export const Empty: Story = {
  render: () => () =>
    wrap([
      h(BasePageHeader, HEADER_PROPS),
      h(ActivityList, { entries: [], loading: false }),
    ]),
}
