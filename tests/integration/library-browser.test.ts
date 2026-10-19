import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LibraryBrowser from '../../app/components/openings/LibraryBrowser.vue'
import type {
  Catalog,
  Family,
  OpeningLibrary,
} from '../../app/modules/openings/public'

const family: Family = {
  summary: { id: 'italian', name: 'Italian Game', topicId: 'e4', lineCount: 1 },
  lines: [
    {
      id: 'classical',
      eco: 'C50',
      name: 'Italian Game: Classical',
      familyId: 'italian',
      topicId: 'e4',
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
      suggestedSide: 'white',
    },
  ],
}
const catalog: Catalog = {
  version: 1,
  revision: 'fixture',
  lineCount: 1,
  topics: [{ id: 'e4', name: 'King’s Pawn', lineCount: 1, familyCount: 1 }],
  families: [family.summary],
}
const library: OpeningLibrary = {
  catalog: async () => catalog,
  family: async () => family,
  line: async () => family.lines[0]!,
}

describe('opening library browser', () => {
  it('lists the shortest complete variation first rather than its shorter named prefixes', async () => {
    const base = family.lines[0]!
    const short = {
      ...base,
      id: 'short',
      name: 'Short complete line',
      moves: [...base.moves.slice(0, 5), 'Nf6', 'Ng5'],
    }
    const long = {
      ...base,
      id: 'long',
      name: 'Long complete line',
      moves: [...base.moves, 'c3', 'Nf6', 'd4'],
    }
    const wrapper = mount(LibraryBrowser, {
      props: {
        catalog,
        library: {
          ...library,
          family: async () => ({ ...family, lines: [base, long, short] }),
        },
        progress: {},
        side: 'white',
      },
    })
    await flushPromises()
    expect(
      wrapper.findAll('.line-card').map((row) => row.attributes('data-testid')),
    ).toEqual(['line-short', 'line-long'])
    await wrapper
      .get('button[aria-label="Nächste Variante lernen"]')
      .trigger('click')
    expect(wrapper.emitted('practice')?.[0]).toEqual([
      { familyId: 'italian', lineId: 'short', mode: 'guided' },
    ])
  })
  it('opens Italian directly and offers only unique complete variations', async () => {
    const leaf = family.lines[0]!
    const expanded: Family = {
      ...family,
      lines: [
        { ...leaf, id: 'prefix', moves: leaf.moves.slice(0, 5) },
        leaf,
        { ...leaf, id: 'duplicate', name: 'Same moves under another name' },
      ],
    }
    const wrapper = mount(LibraryBrowser, {
      props: {
        catalog,
        library: { ...library, family: async () => expanded },
        progress: {},
        side: 'white',
      },
    })
    await flushPromises()
    expect(wrapper.findAll('.line-card')).toHaveLength(1)
    expect(wrapper.find('[data-testid="line-prefix"]').exists()).toBe(false)
    await wrapper
      .get('button[aria-label="Nächste Variante lernen"]')
      .trigger('click')
    expect(wrapper.emitted('practice')?.[0]).toEqual([
      { familyId: 'italian', lineId: 'classical', mode: 'guided' },
    ])
  })
  it('finds a family, loads its variations and starts the requested mode', async () => {
    const wrapper = mount(LibraryBrowser, {
      props: { catalog, library, progress: {}, side: 'white' },
    })
    await flushPromises()
    const row = wrapper.get('[data-testid="line-classical"]')
    expect(row.text()).toContain('3 Züge')
    await row
      .get('button[aria-label="Wiederholen: Italian Game: Classical"]')
      .trigger('click')
    expect(wrapper.emitted('practice')).toEqual([
      [{ familyId: 'italian', lineId: 'classical', mode: 'review' }],
    ])
  })
  it('offers retry after a failed family load', async () => {
    let requests = 0
    const adapter = {
      ...library,
      family: async () => {
        if (++requests === 1) throw new Error('offline')
        return family
      },
    }
    const wrapper = mount(LibraryBrowser, {
      props: { catalog, library: adapter, progress: {}, side: 'white' },
    })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('nicht geladen')
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="line-classical"]').exists()).toBe(true)
  })
  it('ignores an obsolete family request after the library adapter changes', async () => {
    let resolveFamily!: (value: Family) => void
    const adapter = {
      ...library,
      family: () =>
        new Promise<Family>((resolve) => {
          resolveFamily = resolve
        }),
    }
    const wrapper = mount(LibraryBrowser, {
      props: { catalog, library: adapter, progress: {}, side: 'white' },
    })
    expect(wrapper.get('[role="status"]').text()).toContain('geladen')
    await wrapper.setProps({ library })
    await flushPromises()
    resolveFamily({
      ...family,
      lines: [{ ...family.lines[0]!, id: 'obsolete' }],
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="line-classical"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="line-obsolete"]').exists()).toBe(false)
  })
  it('filters learned paths by side and keeps mastered prefixes out of new lessons', async () => {
    const leaf = family.lines[0]!
    const wrapper = mount(LibraryBrowser, {
      props: {
        catalog,
        library: {
          ...library,
          family: async () => ({
            ...family,
            lines: [
              { ...leaf, id: 'prefix', moves: leaf.moves.slice(0, 5) },
              leaf,
            ],
          }),
        },
        progress: {
          'white:classical': {
            lineId: 'classical',
            side: 'white',
            status: 'mastered',
            cleanRepetitions: 5,
            lastPracticedAt: 1,
          },
        },
        side: 'white',
      },
    })
    await flushPromises()
    expect(wrapper.findAll('.line-card')).toHaveLength(0)
    expect(wrapper.text()).toContain('Alle Varianten gelernt.')
    expect(
      wrapper.find('button[aria-label="Nächste Variante lernen"]').exists(),
    ).toBe(false)
    await wrapper.get('.filters button:nth-child(2)').trigger('click')
    expect(wrapper.findAll('.line-card')).toHaveLength(1)
    expect(wrapper.get('.line-card').text()).toContain('Gelernt')
    await wrapper.setProps({ side: 'black' })
    expect(wrapper.findAll('.line-card')).toHaveLength(0)
    await wrapper.get('.filters button:first-child').trigger('click')
    expect(wrapper.findAll('.line-card')).toHaveLength(1)
    await wrapper.get('input[type="search"]').setValue('not an opening')
    expect(wrapper.findAll('.line-card')).toHaveLength(0)
    await wrapper.get('input[type="search"]').setValue('Bc5')
    expect(wrapper.findAll('.line-card')).toHaveLength(1)
  })
})
