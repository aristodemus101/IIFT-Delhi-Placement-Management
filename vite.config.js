import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        // Inline the service worker registration so no extra file needed
        injectRegister: 'auto',
        // Cache the built assets + runtime Firebase calls
        workbox: {
          // App shell: cache all Vite-built assets
          globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
          // Runtime caching for Google Fonts (used by DM Sans)
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                cacheableResponse: { statuses: [0, 200] },
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
          // Firestore / Firebase JS SDK goes through network — don't cache
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/__/, /\/[^/?]+\.[^/]+$/],
        },
        manifest: {
          name: 'PlacementOS — IIFT Delhi',
          short_name: 'PlacementOS',
          description: 'Placement management platform for IIFT Delhi',
          theme_color: '#3B5BDB',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
      }),
    ],
    test: {
      environment: 'node',
    },
  }
})
