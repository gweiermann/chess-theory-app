import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SettingsPanel from '../../app/components/learning/SettingsPanel.vue'
import { DEFAULT_SETTINGS } from '../../app/modules/shared'
import type { LearningOutcome } from '../../app/modules/shared'

const event = (changes: Partial<LearningOutcome> = {}): LearningOutcome => ({
  id: 'recent',
  at: 1000,
  lineId: 'classical',
  familyId: 'italian',
  side: 'white',
  mode: 'guided',
  positionKey: 'start',
  move: 'e4',
  grade: 'recalled',
  mistakes: 0,
  completed: false,
  cleanRepetitions: 0,
  datasetRevision: 'fixture',
  ...changes,
})

describe('learning settings', () => {
  it('edits an independent form and emits validated settings on save', async () => {
    const settings = { ...DEFAULT_SETTINGS }
    const wrapper = mount(SettingsPanel, { props: { settings } })
    await wrapper.get('select[name="side"]').setValue('black')
    await wrapper.get('input[name="repetitions"]').setValue('3')
    await wrapper.get('input[name="premoves"]').setValue(false)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toEqual([
      [{ ...DEFAULT_SETTINGS, side: 'black', repetitions: 3, premoves: false }],
    ])
    expect(settings).toEqual(DEFAULT_SETTINGS)
  })
  it.each(['0', '21', '1.5', ''])(
    'prevents saving invalid repetition input %s',
    async (value) => {
      const wrapper = mount(SettingsPanel, {
        props: { settings: { ...DEFAULT_SETTINGS } },
      })
      await wrapper.get('input[name="repetitions"]').setValue(value)
      await wrapper.get('form').trigger('submit')
      expect(wrapper.emitted('save')).toBeUndefined()
      expect(wrapper.get('[role="alert"]').text()).toContain(
        'zwischen 1 und 20',
      )
      expect(
        wrapper.get('button[type="submit"]').attributes('disabled'),
      ).toBeDefined()
    },
  )
  it('blocks interaction while saving and refreshes form values from persisted settings', async () => {
    const wrapper = mount(SettingsPanel, {
      props: { settings: { ...DEFAULT_SETTINGS }, saving: true },
    })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="status"]').text()).toContain('gespeichert')
    await wrapper.setProps({
      saving: false,
      settings: { ...DEFAULT_SETTINGS, repetitions: 7 },
    })
    expect(
      (wrapper.get('input[name="repetitions"]').element as HTMLInputElement)
        .value,
    ).toBe('7')
  })
  it('lists only the latest non-skipped practice per line and side and resumes its exercise', async () => {
    const wrapper = mount(SettingsPanel, {
      props: {
        settings: { ...DEFAULT_SETTINGS },
        lineNames: { classical: 'Italian Game: Classical' },
        activity: [
          event(),
          event({ id: 'new', at: 2000, kind: 'round', grade: 'hinted' }),
          event({ id: 'skip', at: 3000, grade: 'skipped' }),
          event({ id: 'black', at: 4000, side: 'black', mode: 'sparring' }),
        ],
      },
    })
    expect(wrapper.findAll('.recent li')).toHaveLength(2)
    expect(wrapper.text()).toContain('Italian Game: Classical')
    expect(wrapper.text()).not.toContain('italian|')
    await wrapper
      .get(
        'button[aria-label="Erneut üben: Italian Game: Classical mit Schwarz"]',
      )
      .trigger('click')
    expect(wrapper.emitted('resume')).toEqual([
      [
        {
          familyId: 'italian',
          lineId: 'classical',
          side: 'black',
          mode: 'sparring',
        },
      ],
    ])
    expect(wrapper.text()).toContain('Mit Hilfe')
  })
  it('shows mastery by color and a readable fallback without exposing internal IDs', () => {
    const wrapper = mount(SettingsPanel, {
      props: {
        settings: { ...DEFAULT_SETTINGS },
        activity: [event({ lineId: 'internal-hash-123' })],
        progress: {
          white: {
            lineId: 'a',
            side: 'white',
            status: 'mastered',
            cleanRepetitions: 5,
            lastPracticedAt: 1000,
          },
          black: {
            lineId: 'b',
            side: 'black',
            status: 'practicing',
            cleanRepetitions: 2,
            lastPracticedAt: 1000,
          },
        },
      },
    })
    expect(
      wrapper.findAll('.counts strong').map((value) => value.text()),
    ).toEqual(['1', '0'])
    expect(wrapper.text()).toContain('Zugfolge')
    expect(wrapper.text()).not.toContain('internal-hash-123')
  })
})
