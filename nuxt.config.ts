export default defineNuxtConfig({
  compatibilityDate: '2026-05-24',
  devtools: { enabled: true },
  experimental: {
    appManifest: false,
  },
  app: {
    head: {
      meta: [
        { name: 'robots', content: 'noindex, nofollow, noarchive, nosnippet' },
      ],
    },
  },
  css: ['~/assets/css/main.css', '~/assets/css/workspace.css'],
  nitro: {
    preset: 'cloudflare_pages',
  },
  routeRules: {
    '/**': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
      },
    },
    '/admin': { ssr: false },
    '/': { ssr: false },
  },
  runtimeConfig: {
    sessionSecret: '',
    public: {
      appName: 'Inkpad',
    },
  },
})
