import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DevPlayCommandInput from '~/components/play/DevPlayCommandInput.vue'

describe('DevPlayCommandInput', () => {
  it('emits command with SAN on Enter and clears the field', async () => {
    const wrapper = mount(DevPlayCommandInput, { props: { disabled: false } })
    const input = wrapper.get('[data-testid="dev-play-command-input"]')
    await input.setValue('e4')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('command')?.[0]).toEqual(['e4'])
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('does not emit when the line is empty after trim', async () => {
    const wrapper = mount(DevPlayCommandInput, { props: { disabled: false } })
    const input = wrapper.get('[data-testid="dev-play-command-input"]')
    await input.setValue('   ')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('command')).toBeUndefined()
  })

  it('shows next-move hint caption and SAN when provided', () => {
    const wrapper = mount(DevPlayCommandInput, {
      props: {
        disabled: false,
        nextMoveCaption: 'Your move (SAN)',
        nextMoveSan: 'Nf3',
      },
    })
    expect(wrapper.get('[data-testid="dev-play-next-move-hint"]').text()).toContain('Your move (SAN)')
    expect(wrapper.get('[data-testid="dev-play-next-san"]').text()).toBe('Nf3')
  })
})
