import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseSectionHeading from '~/components/base/BaseSectionHeading.vue'

describe('BaseSectionHeading', () => {
  it('renders the title as h2 by default', () => {
    const wrapper = mount(BaseSectionHeading, { props: { title: 'Familien' } })
    expect(wrapper.get('h2').text()).toBe('Familien')
  })

  it('renders the eyebrow when provided', () => {
    const wrapper = mount(BaseSectionHeading, {
      props: { title: 'Familien', eyebrow: 'Übersicht' },
    })
    expect(wrapper.text()).toContain('Übersicht')
  })

  it('renders the actions slot', () => {
    const wrapper = mount(BaseSectionHeading, {
      props: { title: 'Hi' },
      slots: { actions: '<a data-testid="more">Mehr</a>' },
    })
    expect(wrapper.find('[data-testid="more"]').exists()).toBe(true)
  })

  it('respects an explicit heading level', () => {
    const wrapper = mount(BaseSectionHeading, {
      props: { title: 'Hi', as: 'h3' },
    })
    expect(wrapper.find('h2').exists()).toBe(false)
    expect(wrapper.get('h3').text()).toBe('Hi')
  })
})
