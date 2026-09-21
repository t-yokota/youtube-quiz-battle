// Start npm run dev first. Run with node tests/browser/embedded-scroll.mjs.
// Requires Playwright; PLAYWRIGHT_MODULE / CHROMIUM_PATH can select an existing installation.
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const baseURL = process.env.APP_URL || 'http://127.0.0.1:5173'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
})
try {
  for (const [width, height, embedded] of [
    [310, 620, true],
    [334, 668, true],
    [360, 780, true],
    [320, 568, true],
    [390, 844, true],
    [360, 780, false],
    [310, 400, true],
  ]) {
    const page = await browser.newPage({
      viewport: embedded ? { width: 360, height: 780 } : { width, height },
      isMobile: true,
      hasTouch: true,
    })
    await page.route('**/*', (route) =>
      route.request().url().startsWith(baseURL) ? route.continue() : route.abort(),
    )
    await page.addInitScript(() => {
      window.YT = {
        Player: class {
          constructor(id, options) {
            setTimeout(() => options.events.onReady(), 0)
          }
          getCurrentTime() {
            return 0
          }
          getDuration() {
            return 500
          }
          getPlayerState() {
            return -1
          }
          getVideoData() {
            return { title: 'Layout test' }
          }
          destroy() {}
          mute() {}
          unMute() {}
          setVolume() {}
          playVideo() {}
          pauseVideo() {}
          seekTo() {}
          loadVideoById() {}
        },
      }
    })
    let frame
    if (embedded) {
      await page.route(`${baseURL}/__embed-test`, (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: `<meta name="viewport" content="width=device-width,initial-scale=1"><iframe style="border:0;width:${width}px;height:${height}px" src="${baseURL}/?quiz=sample"></iframe>`,
        }),
      )
      await page.goto(`${baseURL}/__embed-test`)
      frame = await (await page.locator('iframe').elementHandle()).contentFrame()
    } else {
      await page.goto(`${baseURL}/?quiz=sample`)
      frame = page.mainFrame()
    }
    await frame.getByText('タップしてはじめる', { exact: true }).click()
    await frame.locator('.display-mode-toggle').waitFor()
    await page.waitForTimeout(1200)
    const measure = () =>
      frame.evaluate(() => {
        const main = document.querySelector('.main-content')
        main.scrollTop = 10000
        const scroll = main.scrollTop
        main.scrollTop = 0
        const rect = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON()
        return {
          scroll,
          toggle: rect('.display-mode-toggle'),
          artwork: rect('.display-mode-artwork'),
          game: rect('.game-ui'),
        }
      })
    const before = await measure()
    console.log(JSON.stringify({ width, height, embedded, ...before }))
    assert.equal(before.toggle.width, 44)
    assert.equal(before.toggle.height, 36)
    if (height >= 568) assert.equal(before.scroll, 0, `${width}x${height}: unnecessary scroll`)
    else assert.ok(before.scroll > 0, 'Short screens must remain scrollable')
    if (height >= 568)
      assert.ok(
        before.toggle.bottom <= before.game.bottom + 0.02,
        'Tap region must fit inside game UI',
      )
    // The artwork must remain inside the controls container.
    const artworkOffset = await frame.evaluate(() => {
      const container = document.querySelector('.quiz-button-container').getBoundingClientRect()
      const artwork = document.querySelector('.display-mode-artwork').getBoundingClientRect()
      return artwork.bottom - container.bottom
    })
    assert.ok(artworkOffset <= 0, 'Artwork must fit inside the controls container')
    if (height >= 568) {
      // Tap near the bottom edge, outside the small visible icon, to verify the hit area.
      const toggle = frame.locator('.display-mode-toggle')
      await toggle.tap({ position: { x: 22, y: before.toggle.height - 2 } })
      await frame.locator('.button-type-toggle').waitFor()
      await frame.locator('.button-rig').waitFor({ state: 'hidden' })
      const typeAccessible = await frame.evaluate(() => {
        const control = document.querySelector('.button-type-toggle')
        const rect = control.getBoundingClientRect()
        const hit = document.elementFromPoint(rect.x + 22, rect.y + 22)
        return { accessible: control.contains(hit), rect: rect.toJSON(), hit: hit?.outerHTML }
      })
      assert.ok(typeAccessible.accessible, JSON.stringify(typeAccessible))
      assert.equal((await measure()).scroll, 0, '3D mode must not add scroll')
      await toggle.tap({ position: { x: 22, y: before.toggle.height - 2 } })
      await frame.locator('.button-type-toggle').waitFor({ state: 'detached' })
      if (embedded && width === 310) {
        await page.evaluate(async () => {
          const iframe = document.querySelector('iframe')
          await iframe.requestFullscreen()
        })
        await page.waitForTimeout(1200)
        assert.equal((await measure()).scroll, 0, 'Fullscreen must not add scroll')
        await page.evaluate(() => document.exitFullscreen())
        await page.waitForTimeout(1200)
        assert.equal((await measure()).scroll, 0, 'Returning from fullscreen must not add scroll')
      }
      await frame.getByRole('button', { name: '設定を開く' }).click()
      const scrollable = await frame.evaluate(() =>
        [...document.querySelectorAll('*')].some((el) => {
          if (
            !['auto', 'scroll'].includes(getComputedStyle(el).overflowY) ||
            el.scrollHeight <= el.clientHeight
          )
            return false
          el.scrollTop = 100
          return el.scrollTop > 0
        }),
      )
      assert.ok(scrollable, 'Settings must remain scrollable')
    }
    await page.close()
  }
} finally {
  await browser.close()
}
