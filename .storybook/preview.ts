import type { Preview } from '@storybook/vue3-vite'
import { addons } from 'storybook/preview-api'
import '../app/assets/main.css'

// The browser suite observes Storybook's actual play-function result, rather
// than assuming that a rendered canvas means its interaction checks passed.
const results: Record<string, string> = {}
Object.assign(globalThis, { __storyResults: results })
addons
  .getChannel()
  .on('storyFinished', (event: { storyId: string; status: string }) => {
    results[event.storyId] = event.status
  })

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: 'todo' },
  },
}
export default preview
