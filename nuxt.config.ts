export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@vite-pwa/nuxt'],
  css: ['~/assets/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      title: 'Chess Theory · Eröffnungen verstehen',
      meta: [
        { name: 'theme-color', content: '#315f46' },
        {
          name: 'description',
          content: 'Lerne Eröffnungen und erkenne ihre Varianten im Spiel.',
        },
      ],
    },
  },
  pwa: {
    registerType: 'prompt',
    client: { registerPlugin: false },
    manifest: {
      id: './',
      name: 'Chess Theory',
      short_name: 'Chess Theory',
      description: 'Lerne Eröffnungen und erkenne ihre Varianten im Spiel.',
      lang: 'de',
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: '#f4f5ef',
      theme_color: '#315f46',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        {
          src: 'icons/maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      clientsClaim: true,
      globPatterns: ['**/*.{js,css,html,json,png,svg,ico,webmanifest}'],
      navigateFallbackDenylist: [/\/data\//, /\/_nuxt\//, /\/icons\//],
      cleanupOutdatedCaches: true,
    },
    // Keep the worker out of development so it cannot cache Vite/HMR responses.
    devOptions: { enabled: false },
  },
  typescript: { strict: true },
  vite: { optimizeDeps: { include: ['chess.js'] } },
})
