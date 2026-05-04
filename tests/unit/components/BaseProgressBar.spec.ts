import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseProgressBar from '~/components/base/BaseProgressBar.vue'

describe('BaseProgressBar', () => {
  it('renders the given percent on the progressbar role', () => {
    const wrapper = mount(BaseProgressBar, { props: { percent: 42 } })
    const bar = wrapper.get('[role="progressbar"]')
    expect(bar.attributes('aria-valuenow')).toBe('42')
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('100')
  })

  it('clamps negative percent to 0', () => {
    const wrapper = mount(BaseProgressBar, { props: { percent: -10 } })
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
  })

  it('clamps percent above 100', () => {
    const wrapper = mount(BaseProgressBar, { props: { percent: 150 } })
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('100')
  })

  it('rounds non-integer percents', () => {
    const wrapper = mount(BaseProgressBar, { props: { percent: 33.6 } })
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('34')
  })

  it('uses sm size class when size="sm"', () => {
    const wrapper = mount(BaseProgressBar, { props: { percent: 50, size: 'sm' } })
    expect(wrapper.get('[role="progressbar"]').classes()).toContain('h-1.5')
  })

  it('defaults to md size class', () => {
    const wrapper = mount(BaseProgressBar, { props: { percent: 50 } })
    expect(wrapper.get('[role="progressbar"]').classes()).toContain('h-2.5')
  })
})
