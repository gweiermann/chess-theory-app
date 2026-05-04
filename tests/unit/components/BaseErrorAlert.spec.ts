import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseErrorAlert from '~/components/base/BaseErrorAlert.vue'

const stubs = {
  UAlert: {
    props: ['title', 'description', 'color', 'variant', 'icon'],
    template:
      '<div role="alert" :data-color="color" :data-variant="variant" :data-icon="icon"><strong>{{ title }}</strong><p v-if="description">{{ description }}</p></div>',
  },
}

describe('BaseErrorAlert', () => {
  it('renders an alert with the message as the title', () => {
    const wrapper = mount(BaseErrorAlert, {
      props: { message: 'Etwas ist schiefgelaufen' },
      global: { stubs },
    })
    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('Etwas ist schiefgelaufen')
    expect(alert.attributes('data-color')).toBe('error')
  })

  it('uses the provided title and renders the message as description', () => {
    const wrapper = mount(BaseErrorAlert, {
      props: { title: 'Fehler beim Laden', message: 'Verbindung verloren' },
      global: { stubs },
    })
    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('Fehler beim Laden')
    expect(alert.text()).toContain('Verbindung verloren')
  })
})
