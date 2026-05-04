import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseLoadingState from '~/components/base/BaseLoadingState.vue'

describe('BaseLoadingState', () => {
  it('renders the default text variant with a status role', () => {
    const wrapper = mount(BaseLoadingState)
    const status = wrapper.get('[role="status"]')
    expect(status.text()).toContain('Lade Daten')
  })

  it('uses the provided message', () => {
    const wrapper = mount(BaseLoadingState, { props: { message: 'Lade Eröffnungen…' } })
    expect(wrapper.get('[role="status"]').text()).toContain('Lade Eröffnungen…')
  })

  it('renders the configured number of skeleton rows', () => {
    const wrapper = mount(BaseLoadingState, {
      props: { variant: 'skeleton', skeletonCount: 4 },
    })
    expect(wrapper.findAll('[data-skeleton-row]').length).toBe(4)
  })

  it('skeleton variant exposes a status role with screen-reader text', () => {
    const wrapper = mount(BaseLoadingState, {
      props: { variant: 'skeleton', message: 'Lade Liste…' },
    })
    expect(wrapper.get('[role="status"]').text()).toContain('Lade Liste…')
  })
})
