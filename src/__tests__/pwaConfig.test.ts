import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const viteConfig = readFileSync(resolve(root, 'vite.config.ts'), 'utf8')
const appSource = readFileSync(resolve(root, 'src/App.vue'), 'utf8')
const indexHtml = readFileSync(resolve(root, 'index.html'), 'utf8')

describe('PWA configuration', () => {
  it('GitHub Pages配下へprompt方式のManifestとService Workerを生成する', () => {
    expect(viteConfig).toContain("import { VitePWA } from 'vite-plugin-pwa'")
    expect(viteConfig).toContain("const BASE_PATH = '/youtube-quiz-battle/'")
    expect(viteConfig).toContain("registerType: 'prompt'")
    expect(viteConfig).toContain('start_url: BASE_PATH')
    expect(viteConfig).toContain('scope: BASE_PATH')
    expect(viteConfig).toContain("display: 'standalone'")
    expect(viteConfig).toContain("orientation: 'portrait'")
    expect(viteConfig).toContain("theme_color: '#f0efec'")
    expect(viteConfig).toContain("background_color: '#f0efec'")
    expect(viteConfig).toContain("purpose: 'any maskable'")
    expect(viteConfig).toContain('cleanupOutdatedCaches: true')
  })

  it('アプリから更新通知UIを常時マウントする', () => {
    expect(appSource).toContain(
      "import PwaUpdatePrompt from './components/common/PwaUpdatePrompt.vue'",
    )
    expect(appSource).toContain('<PwaUpdatePrompt />')
  })

  it('iOS向けアイコンとPWA派生アイコンを用意する', () => {
    const assets = [
      'public/icon.svg',
      'public/pwa-192x192.png',
      'public/pwa-512x512.png',
      'public/pwa-maskable-512x512.png',
      'public/apple-touch-icon.png',
    ]

    for (const asset of assets) expect(existsSync(resolve(root, asset)), asset).toBe(true)
    expect(indexHtml).toContain(
      '<link rel="apple-touch-icon" href="/youtube-quiz-battle/apple-touch-icon.png" />',
    )
    expect(viteConfig).toContain('src: `${BASE_PATH}icon.svg`')
    expect(viteConfig).toMatch(
      /src: `\$\{BASE_PATH\}icon\.svg`,\s+sizes: 'any',\s+type: 'image\/svg\+xml',\s+purpose: 'any maskable'/,
    )
  })

  it('Androidのナビゲーション領域へ初回表示を広げない', () => {
    expect(indexHtml).not.toContain('viewport-fit=cover')
  })
})
