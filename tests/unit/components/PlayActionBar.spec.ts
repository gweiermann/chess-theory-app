import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PlayActionBar from '~/components/play/PlayActionBar.vue'

const stubs = { UIcon: { props: ['name'], template: '<i />' } }

describe('PlayActionBar', () => {
  it('keeps Hilfe enabled when a hint is showing so it can act as a toggle', () => {
    const wrapper = mount(PlayActionBar, {
      props: {
        hintActive: true,
        hintDisabled: false,
        canGoBackward: true,
        canGoForward: false,
      },
      global: { stubs },
    })
    const btn = wrapper.find('[aria-label="Hilfe"]')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.attributes('aria-pressed')).toBe('true')
  })

  it('disables Hilfe only for structural hintDisabled', () => {
    const wrapper = mount(PlayActionBar, {
      props: {
        hintActive: false,
        hintDisabled: true,
        canGoBackward: false,
        canGoForward: true,
      },
      global: { stubs },
    })
    const btn = wrapper.find('[aria-label="Hilfe"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })
})
