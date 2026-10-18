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
  it('finds a family, loads its variations and starts the requested mode', async () => {
    const wrapper = mount(LibraryBrowser, {
      props: { catalog, library, progress: {}, side: 'white' },
    })
    await wrapper.get('input[type="search"]').setValue('italian')
    await wrapper.get('[data-testid="family-italian"]').trigger('click')
    await flushPromises()
    const row = wrapper.get('[data-testid="line-classical"]')
    expect(row.text()).toContain('C50')
    await row
      .get('button[aria-label="Sparring: Italian Game: Classical"]')
      .trigger('click')
    expect(wrapper.emitted('practice')).toEqual([
      [{ familyId: 'italian', lineId: 'classical', mode: 'sparring' }],
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
    await wrapper.get('[data-testid="family-italian"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('nicht geladen')
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="line-classical"]').exists()).toBe(true)
  })
  it('does not reveal an obsolete request after returning to the catalog', async () => {
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
    await wrapper.get('[data-testid="family-italian"]').trigger('click')
    expect(wrapper.get('[role="status"]').text()).toContain('geladen')
    await wrapper.get('button.back').trigger('click')
    resolveFamily(family)
    await flushPromises()
    expect(wrapper.find('[data-testid="line-classical"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="family-italian"]').exists()).toBe(true)
  })
  it('paginates long families while searching all variations', async () => {
    const longFamily: Family = {
      summary: { ...family.summary, lineCount: 45 },
      lines: Array.from({ length: 45 }, (_, index) => ({
        ...family.lines[0]!,
        id: `variation-${index}`,
        name: `Italian Game: Variation ${index}`,
      })),
    }
    const wrapper = mount(LibraryBrowser, {
      props: {
        catalog,
        library: { ...library, family: async () => longFamily },
        progress: {},
        side: 'black',
      },
    })
    await wrapper.get('[data-testid="family-italian"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.line-card')).toHaveLength(20)
    await wrapper.get('button.more').trigger('click')
    expect(wrapper.findAll('.line-card')).toHaveLength(40)
    await wrapper.get('input[type="search"]').setValue('Variation 44')
    expect(wrapper.findAll('.line-card')).toHaveLength(1)
    expect(wrapper.get('[data-testid="line-variation-44"]').text()).toContain(
      'Noch nicht geübt',
    )
  })
})
