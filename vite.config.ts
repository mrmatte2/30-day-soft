import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Must match your GitHub repo name so assets resolve correctly on GitHub Pages
// (https://<user>.github.io/<repo>/). Change this if you rename/fork the repo.
const REPO_NAME = '30-day-soft'

// https://vite.dev/config/
export default defineConfig({
  base: `/${REPO_NAME}/`,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: '30 Day Soft',
        short_name: '30 Day Soft',
        description: 'A softer daily challenge tracker for 3 people.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#faf9fc',
        theme_color: '#7c3aed',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
    }),
  ],
})
