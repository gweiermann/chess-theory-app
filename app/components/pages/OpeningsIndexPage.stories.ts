import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import BasePageHeader from '~/components/base/BasePageHeader.vue'
import BaseLoadingState from '~/components/base/BaseLoadingState.vue'
import BaseErrorAlert from '~/components/base/BaseErrorAlert.vue'
import OpeningsIndexPageFixture from './OpeningsIndexPage.fixture.vue'

const meta: Meta = { title: 'Pages/Openings – Index' }
export default meta
type Story = StoryObj<typeof meta>

const HEADER_PROPS = {
  eyebrow: 'Eröffnungen',
  title: 'Wähle eine Gruppe',
  description: 'Tipp auf eine Gruppe, um die Eröffnungen zu sehen und gezielt eine Zugfolge auszuwählen, die du als Nächstes üben möchtest.',
}

const TOPICS = [
  { id: 'e4', label: 'e4', familyCount: 8, lineCount: 42, mastered: 3 },
  { id: 'd4', label: 'd4', familyCount: 6, lineCount: 28, mastered: 0 },
  { id: 'c4', label: 'c4', familyCount: 3, lineCount: 15, mastered: 3 },
]

const wrap = (children: ReturnType<typeof h>[]) =>
  h('div', { class: 'mx-auto w-full max-w-5xl px-4 py-6 sm:py-10' }, children)

export const Loading: Story = {
  render: () => () =>
    wrap([
      h(BasePageHeader, HEADER_PROPS),
      h(BaseLoadingState, { variant: 'skeleton', skeletonCount: 6, message: 'Lade Eröffnungen…' }),
    ]),
}

export const Error: Story = {
  render: () => () =>
    wrap([
      h(BasePageHeader, HEADER_PROPS),
      h(BaseErrorAlert, { message: 'Eröffnungen konnten nicht geladen werden.' }),
    ]),
}

export const Default: Story = {
  name: 'Default – With Topics',
  render: () => () =>
    wrap([
      h(BasePageHeader, HEADER_PROPS),
      h(OpeningsIndexPageFixture, { topics: TOPICS }),
    ]),
}
