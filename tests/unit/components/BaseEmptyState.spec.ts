import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseEmptyState from '~/components/base/BaseEmptyState.vue'

const stubs = { UIcon: { props: ['name'], template: '<i :data-icon="name" />' } }

describe('BaseEmptyState', () => {
  it('renders the icon, title and optional description', () => {
    const wrapper = mount(BaseEmptyState, {
      props: {
        icon: 'i-lucide-search',
        title: 'Keine Treffer',
        description: 'Versuche einen anderen Suchbegriff.',
      },
      global: { stubs },
    })
    expect(wrapper.find('[data-icon="i-lucide-search"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Keine Treffer')
    expect(wrapper.text()).toContain('Versuche einen anderen Suchbegriff.')
  })

  it('omits the description when not provided', () => {
    const wrapper = mount(BaseEmptyState, {
      props: { icon: 'i-lucide-search', title: 'Keine Treffer' },
      global: { stubs },
    })
    expect(wrapper.find('[data-empty-description]').exists()).toBe(false)
  })

  it('renders the actions slot', () => {
    const wrapper = mount(BaseEmptyState, {
      props: { icon: 'i-lucide-search', title: 'Keine Treffer' },
      slots: { actions: '<button data-testid="cta">Zurück</button>' },
      global: { stubs },
    })
    expect(wrapper.find('[data-testid="cta"]').exists()).toBe(true)
  })
})
