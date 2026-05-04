import type { StorybookConfig } from '@storybook-vue/nuxt'

const config: StorybookConfig = {
  framework: '@storybook-vue/nuxt',
  stories: [
    '../app/components/**/*.stories.@(ts|js)',
  ],
  addons: ['@storybook/addon-a11y'],
}

export default config
