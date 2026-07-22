import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://getveritio.com',
  // React exists solely for the homepage Remotion hero island; the site has no
  // adapter and stays fully static — the island is client:only and never SSRs.
  // sitemap emits /sitemap-index.xml at build time; it is submitted to Google
  // Search Console (sc-domain:getveritio.com), so keep the integration in place.
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
})
