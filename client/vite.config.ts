import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative paths, so the same build runs from a site's root and from a subfolder inside a
  // frame, which is how itch.io serves it.
  base: './',
  // Listen on the LAN so a second device can join during development.
  server: { host: true },
})
