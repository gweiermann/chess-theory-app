import type { StorybookConfig } from '@storybook/vue3-vite'
import vue from '@vitejs/plugin-vue'

const config: StorybookConfig = {
  stories: ['../app/components/**/*.stories.ts'],
  addons: ['@storybook/addon-a11y'],
  framework: { name: '@storybook/vue3-vite', options: {} },
  docs: { autodocs: 'tag' },
  viteFinal(config) {
    if (
      !config.plugins
        ?.flat()
        .some(
          (plugin) =>
            plugin &&
            typeof plugin === 'object' &&
            'name' in plugin &&
            plugin.name === 'vite:vue',
        )
    )
      config.plugins = [...(config.plugins ?? []), vue()]
    return config
  },
}
export default config
