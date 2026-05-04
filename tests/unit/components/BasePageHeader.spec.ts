import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BasePageHeader from '~/components/base/BasePageHeader.vue'

describe('BasePageHeader', () => {
  it('renders the title as a level-1 heading', () => {
    const wrapper = mount(BasePageHeader, { props: { title: 'Modus wählen' } })
    const h1 = wrapper.get('h1')
    expect(h1.text()).toBe('Modus wählen')
  })

  it('renders the optional eyebrow above the title', () => {
    const wrapper = mount(BasePageHeader, {
      props: { eyebrow: 'Lernen', title: 'Modus wählen' },
    })
    expect(wrapper.text()).toContain('Lernen')
    expect(wrapper.text()).toContain('Modus wählen')
  })

  it('omits the eyebrow when not provided', () => {
    const wrapper = mount(BasePageHeader, { props: { title: 'Modus wählen' } })
    expect(wrapper.find('[data-base-page-header-eyebrow]').exists()).toBe(false)
  })

  it('renders the optional description', () => {
    const wrapper = mount(BasePageHeader, {
      props: { title: 'Hi', description: 'Sub-copy' },
    })
    expect(wrapper.text()).toContain('Sub-copy')
  })

  it('renders the actions slot', () => {
    const wrapper = mount(BasePageHeader, {
      props: { title: 'Hi' },
      slots: { actions: '<button data-testid="cta">Go</button>' },
    })
    expect(wrapper.find('[data-testid="cta"]').exists()).toBe(true)
  })
})
