import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseSelectableCard from '~/components/base/BaseSelectableCard.vue'

const stubs = {
  UIcon: { props: ['name'], template: '<i :data-icon="name" />' },
  UBadge: {
    props: ['color', 'variant', 'size'],
    template: '<span data-badge><slot /></span>',
  },
}

describe('BaseSelectableCard', () => {
  it('renders the icon, title and description', () => {
    const wrapper = mount(BaseSelectableCard, {
      props: {
        icon: 'i-lucide-book-open',
        title: 'Eröffnungen lernen',
        description: 'Übe Schritt für Schritt.',
        selected: false,
      },
      global: { stubs },
    })
    expect(wrapper.find('[data-icon="i-lucide-book-open"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Eröffnungen lernen')
    expect(wrapper.text()).toContain('Übe Schritt für Schritt.')
  })

  it('reports the selected state via aria-pressed', () => {
    const wrapper = mount(BaseSelectableCard, {
      props: { icon: 'i-lucide-book-open', title: 'Item', selected: true },
      global: { stubs },
    })
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
  })

  it('emits select on click when not disabled', async () => {
    const wrapper = mount(BaseSelectableCard, {
      props: { icon: 'i-lucide-book-open', title: 'Item', selected: false },
      global: { stubs },
    })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('select')?.length).toBe(1)
  })

  it('does not emit select when disabled', async () => {
    const wrapper = mount(BaseSelectableCard, {
      props: {
        icon: 'i-lucide-book-open',
        title: 'Item',
        selected: false,
        disabled: true,
      },
      global: { stubs },
    })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('renders the badge slot when provided', () => {
    const wrapper = mount(BaseSelectableCard, {
      props: { icon: 'i-lucide-shuffle', title: 'Item', selected: false, badge: 'Demnächst' },
      global: { stubs },
    })
    expect(wrapper.find('[data-badge]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Demnächst')
  })
})
