import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'

const BASE_PATH = '/youtube-quiz-battle/'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages（プロジェクトページ）のサブパス配信
  base: BASE_PATH,
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        id: BASE_PATH,
        name: 'YouTube Quiz Battle',
        short_name: 'Quiz Battle',
        description: 'YouTubeクイズ動画で遊べる早押しクイズゲーム',
        lang: 'ja',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#f0efec',
        background_color: '#f0efec',
        icons: [
          {
            src: `${BASE_PATH}icon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: `${BASE_PATH}icon-192x192.png`,
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: `${BASE_PATH}icon-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: `${BASE_PATH}icon-maskable-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json,wav,mp3}'],
      },
    }),
    // npm run analyze でバンドル構成を stats.html に出力
    ...(mode === 'analyze' ? [visualizer({ filename: 'stats.html', gzipSize: true })] : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    typecheck: {
      tsconfig: './tsconfig.vitest.json',
    },
  },
}))
