import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** NestJS route prefixes — dev proxy sends these to the backend so a single
 * forwarded port (5173) is enough when previewing in Cursor/browser. */
const API_PROXY_PREFIXES = [
  'auth',
  'search',
  'bookings',
  'manage-booking',
  'my',
  'agency-portal',
  'settings',
  'site-content',
  'blog',
  'contact',
  'careers',
  'survey',
  'flight-status',
  'club',
  'flights',
  'flightops',
  'reservation',
  'pricing',
  'refunds',
  'agencies',
  'cartable',
  'referrals',
  'manager-messages',
  'files',
  'reporting',
  'passenger-reports',
  'staff-reports',
  'panels',
  'admins',
  'audit',
  'it',
  'support-tickets',
  'identity-verifications',
  'reconciliation',
  'webservice',
  'health',
  'docs',
] as const

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  /** Override when backend PORT ≠ 3000 (see frontend/.env.example). */
  const apiProxyTarget = env.VITE_DEV_API_PROXY || 'http://127.0.0.1:3000'

  const devProxy = Object.fromEntries(
    API_PROXY_PREFIXES.map((prefix) => [
      `/${prefix}`,
      { target: apiProxyTarget, changeOrigin: true },
    ]),
  )

  return {
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Cloud Agent / localtunnel / Cursor forwarded hosts (dev only)
    allowedHosts: true,
    proxy: devProxy,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'blujet',
        short_name: 'blujet',
        description: 'بلوجت — رزرو بلیط هواپیما',
        theme_color: '#1668c4',
        background_color: '#0d2640',
        display: 'standalone',
        start_url: '/',
        dir: 'rtl',
        lang: 'fa',
        icons: [
          { src: 'icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only — API responses (availability, prices, bookings) must
        // always be fresh, never served from the service worker cache.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  }
})
