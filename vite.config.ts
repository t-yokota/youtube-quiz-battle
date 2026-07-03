import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages（プロジェクトページ）のサブパス配信
  base: '/youtube-quiz-battle/',
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
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
