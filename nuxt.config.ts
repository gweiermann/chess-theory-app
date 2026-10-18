export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/main.css'],
  app: {
    head: {
      title: 'Chess Theory · Eröffnungen verstehen',
      meta: [
        {
          name: 'description',
          content: 'Lerne Eröffnungen und erkenne ihre Varianten im Spiel.',
        },
      ],
    },
  },
  typescript: { strict: true },
  vite: { optimizeDeps: { include: ['chess.js'] } },
})
