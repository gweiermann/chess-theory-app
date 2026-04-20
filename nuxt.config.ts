// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  ssr: false,

  modules: ['@nuxt/ui', '@nuxt/eslint'],

  eslint: {
    config: {
      stylistic: false,
      typescript: true,
    },
  },

  css: ['~/assets/css/main.css'],

  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      title: 'Chess Theory Drill',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Memorize chess opening lines fast.' },
      ],
    },
  },

  nitro: {
    preset: 'github-pages',
    prerender: {
      crawlLinks: false,
      routes: ['/'],
    },
  },

  vite: {
    optimizeDeps: {
      include: ['chess.js'],
    },
  },
})
