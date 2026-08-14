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
      'public/favicon-16x16.png',
      'public/favicon-32x32.png',
      'public/favicon-48x48.png',
      'public/icon-192x192.png',
      'public/icon-512x512.png',
      'public/icon-maskable-512x512.png',
      'public/apple-touch-icon.png',
    ]

    for (const asset of assets) expect(existsSync(resolve(root, asset)), asset).toBe(true)
    for (const obsoleteAsset of [
      'public/favicon.ico',
      'public/icon-16x16.png',
      'public/icon-32x32.png',
      'public/icon-48x48.png',
      'public/pwa-192x192.png',
      'public/pwa-512x512.png',
      'public/pwa-maskable-512x512.png',
    ]) {
      expect(existsSync(resolve(root, obsoleteAsset)), obsoleteAsset).toBe(false)
    }
    expect(indexHtml).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />')
    expect(viteConfig).toContain('src: `${BASE_PATH}icon.svg`')
    expect(viteConfig).toMatch(
      /src: `\$\{BASE_PATH\}icon\.svg`,\s+sizes: 'any',\s+type: 'image\/svg\+xml',\s+purpose: 'any maskable'/,
    )
    expect(viteConfig).toMatch(
      /src: `\$\{BASE_PATH\}icon-192x192\.png`,\s+sizes: '192x192',\s+type: 'image\/png'/,
    )
    expect(viteConfig).toMatch(
      /src: `\$\{BASE_PATH\}icon-512x512\.png`,\s+sizes: '512x512',\s+type: 'image\/png'/,
    )
    expect(viteConfig).toMatch(
      /src: `\$\{BASE_PATH\}icon-maskable-512x512\.png`,\s+sizes: '512x512',\s+type: 'image\/png',\s+purpose: 'any maskable'/,
    )
    expect(viteConfig).not.toContain('pwa-')
  })

  it('favicon用PNGとManifest用PNGの実寸をファイル名に揃える', () => {
    const dimensions = [
      ['public/favicon-16x16.png', 16],
      ['public/favicon-32x32.png', 32],
      ['public/favicon-48x48.png', 48],
      ['public/icon-192x192.png', 192],
      ['public/icon-512x512.png', 512],
      ['public/icon-maskable-512x512.png', 512],
    ] as const

    for (const [asset, expectedSize] of dimensions) {
      const png = readFileSync(resolve(root, asset))
      expect(png.readUInt32BE(16), `${asset} width`).toBe(expectedSize)
      expect(png.readUInt32BE(20), `${asset} height`).toBe(expectedSize)
    }

    const html = new DOMParser().parseFromString(indexHtml, 'text/html')
    for (const size of [16, 32, 48]) {
      const icon = html.querySelector(`link[rel="icon"][sizes="${size}x${size}"]`)
      expect(icon?.getAttribute('type')).toBe('image/png')
      expect(icon?.getAttribute('href')).toBe(`/favicon-${size}x${size}.png`)
    }
    expect(indexHtml).not.toContain('%BASE_URL%')
    expect(indexHtml).not.toContain('href="/youtube-quiz-battle/')
    expect(indexHtml).not.toContain('/youtube-quiz-battle/youtube-quiz-battle/')
    expect(indexHtml).not.toContain('/favicon.ico')
  })

  it('Androidのナビゲーション領域へ初回表示を広げない', () => {
    expect(indexHtml).not.toContain('viewport-fit=cover')
  })
})
