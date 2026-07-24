import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://getveritio.com',
  // Fully static, no client JS. sitemap emits /sitemap-index.xml at build time;
  // it is submitted to Google
  // Search Console (sc-domain:getveritio.com), so keep the integration in place.
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
})
