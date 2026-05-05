import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import BasePageHeader from '~/components/base/BasePageHeader.vue'
import ProfilePageFixture from './ProfilePage.fixture.vue'

const meta: Meta = { title: 'Pages/Profile – Settings' }
export default meta
type Story = StoryObj<typeof meta>

const HEADER_PROPS = {
  eyebrow: 'Profil',
  title: 'Dein Bereich',
  description: 'Hier findest du deinen Fortschritt und deine Lernaktivität.',
}

const wrap = (children: ReturnType<typeof h>[]) =>
  h('div', { class: 'mx-auto w-full max-w-3xl px-4 py-6 sm:py-8' }, children)

export const AutoPlayOff: Story = {
  name: 'Default – AutoPlay Off',
  render: () => () =>
    wrap([
      h(BasePageHeader, HEADER_PROPS),
      h(ProfilePageFixture, { autoPlayOn: false }),
    ]),
}

export const AutoPlayOn: Story = {
  name: 'AutoPlayOn – AutoPlay Enabled',
  render: () => () =>
    wrap([
      h(BasePageHeader, HEADER_PROPS),
      h(ProfilePageFixture, { autoPlayOn: true }),
    ]),
}
