import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://getveritio.com',
  vite: {
    plugins: [tailwindcss()],
  },
})
