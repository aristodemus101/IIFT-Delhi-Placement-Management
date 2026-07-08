import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        workbox: {
          // Precache all JS/CSS assets. Hash-named chunks are immutable so
          // this is safe — new deploy = new hashes = fresh precache entries.
          // Previously only shell chunks were listed, which caused the SW's
          // navigateFallback to intercept lazy chunk fetches and return
          // index.html (text/html) instead of the JS file.
          globPatterns: ['**/*.{html,css,js,ico,svg,woff2}'],
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
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // React + router — tiny, loaded first, always cached
            if (id.includes('node_modules/react/') ||
                id.includes('node_modules/react-dom/') ||
                id.includes('node_modules/react-router-dom/') ||
                id.includes('node_modules/scheduler/')) {
              return 'vendor'
            }
            // Firebase — large but tree-shaken; separate chunk so it can be
            // cached independently across deployments when only app code changes
            if (id.includes('node_modules/firebase/') ||
                id.includes('node_modules/@firebase/')) {
              return 'firebase'
            }
            // xlsx — dynamically imported, but Rollup still needs a named chunk
            // so it doesn't get inlined into the requesting module
            if (id.includes('node_modules/xlsx/')) {
              return 'xlsx'
            }
            // papaparse — small, bundle with app code
          },
        },
      },
    },
    test: {
      environment: 'node',
    },
  }
})
