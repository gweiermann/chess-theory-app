import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ActivityListItem from '~/components/activity/ActivityListItem.vue'
import type { ResolvedActivityEntry } from '~/composables/useRecentActivity'

const stubs = {
  UIcon: { props: ['name'], template: '<i :data-icon="name" />' },
  UBadge: {
    props: ['color', 'variant', 'icon'],
    template: '<span data-badge :data-color="color"><slot /></span>',
  },
  UButton: {
    props: ['size', 'color', 'variant', 'icon', 'disabled'],
    emits: ['click'],
    template:
      '<button data-resume :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
}

const buildEntry = (overrides: Partial<ResolvedActivityEntry> = {}): ResolvedActivityEntry => ({
  topicId: 'e4',
  topicLabel: 'e4',
  lineId: 'italian-main',
  familyName: 'Italian Game',
  status: 'in_progress',
  lastPracticedAt: Date.now() - 5 * 60 * 1000,
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
    averageRepDurationMs: 7200,
    totalRepDurationMs: 28800,
    totalMoves: 16,
  },
  ...overrides,
} as ResolvedActivityEntry)

describe('ActivityListItem', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-05-03T10:00:00Z')) })
  afterEach(() => { vi.useRealTimers() })

  it('renders the topic, family name and ECO + line title', () => {
    const wrapper = mount(ActivityListItem, {
      props: { entry: buildEntry() },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('e4')
    expect(wrapper.text()).toContain('Italian Game')
    expect(wrapper.text()).toContain('C50')
    expect(wrapper.text()).toContain('Italian Game · Main Line')
  })

  it('renders the rep count, mistake count and average duration as stat pills', () => {
    const wrapper = mount(ActivityListItem, {
      props: { entry: buildEntry() },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('Wdh.')
    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).toContain('Fehler')
    expect(wrapper.text()).toContain('1')
    expect(wrapper.text()).toContain('7s')
  })

  it('shows help-count stat only when greater than zero', () => {
    const wrapper = mount(ActivityListItem, {
      props: {
        entry: buildEntry({
          stats: { ...buildEntry().stats, helpCount: 2 },
        }),
      },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('Hilfe')
    expect(wrapper.text()).toContain('2×')
  })

  it('shows the mastered badge when status is mastered', () => {
    const wrapper = mount(ActivityListItem, {
      props: { entry: buildEntry({ status: 'mastered' }) },
      global: { stubs },
    })
    const badges = wrapper.findAll('[data-badge]')
    expect(badges.some((b) => b.text().includes('Gemeistert'))).toBe(true)
  })

  it('shows the in-progress badge by default', () => {
    const wrapper = mount(ActivityListItem, {
      props: { entry: buildEntry() },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('In Arbeit')
  })

  it('renders a fallback when the line is missing', () => {
    const wrapper = mount(ActivityListItem, {
      props: { entry: buildEntry({ line: null }) },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('Zugfolge nicht mehr verfügbar')
  })

  it('disables the resume button when the line is missing', () => {
    const wrapper = mount(ActivityListItem, {
      props: { entry: buildEntry({ line: null }) },
      global: { stubs },
    })
    expect(wrapper.get('[data-resume]').attributes('disabled')).toBeDefined()
  })

  it('emits resume with the entry when the button is clicked', async () => {
    const entry = buildEntry()
    const wrapper = mount(ActivityListItem, {
      props: { entry },
      global: { stubs },
    })
    await wrapper.get('[data-resume]').trigger('click')
    expect(wrapper.emitted('resume')?.[0]?.[0]).toEqual(entry)
  })

  it('formats relative time in minutes for recent activity', () => {
    const wrapper = mount(ActivityListItem, {
      props: { entry: buildEntry({ lastPracticedAt: Date.now() - 5 * 60 * 1000 }) },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('vor 5 min')
  })

  it('formats relative time in hours when older than an hour', () => {
    const wrapper = mount(ActivityListItem, {
      props: { entry: buildEntry({ lastPracticedAt: Date.now() - 3 * 60 * 60 * 1000 }) },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('vor 3 h')
  })
})
