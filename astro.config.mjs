import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import react from '@astrojs/react'

export default defineConfig({
  site: 'https://getveritio.com',
  // React exists solely for the homepage Remotion hero island; the site has no
  // adapter and stays fully static — the island is client:only and never SSRs.
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
})
