import type { Preview } from '@storybook/vue3'
import '~/assets/css/main.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'app',
      values: [
        { name: 'app', value: 'var(--ui-bg)' },
        { name: 'elevated', value: 'var(--ui-bg-elevated)' },
        { name: 'dark', value: '#0a0a0a' },
      ],
    },
  },
}

export default preview
