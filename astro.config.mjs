import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://getveritio.com',
  // EN is unprefixed; DE/KO exist for the money pages under /de/ and /ko/.
  // hreflang alternates are emitted per-page by BaseLayout (only for pages
  // that actually have translations), not by the sitemap integration.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'de', 'ko'],
  },
  // Fully static, no client JS. sitemap emits /sitemap-index.xml at build time;
  // it is submitted to Google
  // Search Console (sc-domain:getveritio.com), so keep the integration in place.
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
})
