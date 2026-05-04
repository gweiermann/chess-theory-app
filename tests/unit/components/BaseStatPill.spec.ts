import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseStatPill from '~/components/base/BaseStatPill.vue'

const stubs = { UIcon: { props: ['name'], template: '<i :data-icon="name" />' } }

describe('BaseStatPill', () => {
  it('renders the label and value', () => {
    const wrapper = mount(BaseStatPill, {
      props: { label: 'Versuche', value: 12 },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('Versuche')
    expect(wrapper.text()).toContain('12')
  })

  it('renders the icon when provided', () => {
    const wrapper = mount(BaseStatPill, {
      props: { label: 'Versuche', value: 12, icon: 'i-lucide-target' },
      global: { stubs },
    })
    expect(wrapper.find('[data-icon="i-lucide-target"]').exists()).toBe(true)
  })

  it('omits the icon container when no icon is provided', () => {
    const wrapper = mount(BaseStatPill, {
      props: { label: 'Versuche', value: 12 },
      global: { stubs },
    })
    expect(wrapper.find('[data-icon]').exists()).toBe(false)
  })

  it('coerces non-string values for display', () => {
    const wrapper = mount(BaseStatPill, {
      props: { label: 'Quote', value: '92%' },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('92%')
  })
})
