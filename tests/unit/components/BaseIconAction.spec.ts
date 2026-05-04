import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseIconAction from '~/components/base/BaseIconAction.vue'

const stubs = { UIcon: { props: ['name'], template: '<i :data-icon="name" />' } }

describe('BaseIconAction', () => {
  it('renders a button with the icon and aria-label', () => {
    const wrapper = mount(BaseIconAction, {
      props: { icon: 'i-lucide-play', label: 'Starten' },
      global: { stubs },
    })
    const btn = wrapper.get('button')
    expect(btn.attributes('type')).toBe('button')
    expect(btn.attributes('aria-label')).toBe('Starten')
    expect(wrapper.find('[data-icon="i-lucide-play"]').exists()).toBe(true)
  })

  it('emits click when activated', async () => {
    const wrapper = mount(BaseIconAction, {
      props: { icon: 'i-lucide-play', label: 'Starten' },
      global: { stubs },
    })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('click')?.length).toBe(1)
  })

  it('does not emit click when disabled', async () => {
    const wrapper = mount(BaseIconAction, {
      props: { icon: 'i-lucide-play', label: 'Starten', disabled: true },
      global: { stubs },
    })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('renders the disabled attribute when disabled', () => {
    const wrapper = mount(BaseIconAction, {
      props: { icon: 'i-lucide-play', label: 'Starten', disabled: true },
      global: { stubs },
    })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })

  it('uses primary emphasis class when emphasis="primary"', () => {
    const wrapper = mount(BaseIconAction, {
      props: { icon: 'i-lucide-play', label: 'Starten', emphasis: 'primary' },
      global: { stubs },
    })
    expect(wrapper.get('button').classes().some((c) => c.includes('primary'))).toBe(true)
  })
})
