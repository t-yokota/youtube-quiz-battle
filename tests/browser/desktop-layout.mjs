// npm run dev, then node tests/browser/desktop-layout.mjs (requires Playwright).
// APP_URL, PLAYWRIGHT_MODULE and CHROMIUM_PATH can select local test installations.
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const baseURL = process.env.APP_URL || 'http://127.0.0.1:5173'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
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
  await page.goto(`${baseURL}/?quiz=sample`)
  await page.getByText('タップしてはじめる', { exact: true }).click()
  await page.waitForTimeout(1200)
  const setState = (state) =>
    page.evaluate(async (state) => {
      const { useGameStore } = await import('/src/stores/gameStore.ts')
      const store = useGameStore()
      store.setCurrentQuestionIndex(0)
      store.transitionToState(state)
    }, state)
  const settle = () => page.waitForTimeout(700)
  const measure = () =>
    page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON()
      const main = document.querySelector('.main-content')
      return {
        video: rect('.video-player-container'),
        panel: rect('.answer-area'),
        stage: rect('.button-stage'),
        input: rect('.answer-input'),
        scroll: main.scrollHeight - main.clientHeight,
        focus: document.activeElement?.className,
      }
    })
  await setState('READY')
  await settle()
  assert.ok((await measure()).panel.height < 100, 'READY must use the compact card')
  assert.equal(await page.locator('.guide-message').textContent(), 'ボタンを押してクイズを開始')
  assert.equal(
    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/stores/gameStore.ts')
      return useGameStore().results.length
    }),
    0,
    'Replay clears the previous results',
  )
  assert.equal(await page.locator('.attempts-counter').count(), 0)
  assert.equal(await page.locator('.down-cue').count(), 0)
  // Guide text changes and guide-to-answer changes must interpolate numeric widths.
  for (const state of ['TALKING', 'QUESTIONING', 'READY']) {
    const widths = await page.evaluate(async (state) => {
      const { useGameStore } = await import('/src/stores/gameStore.ts')
      const card = document.querySelector('.answer-area')
      const samples = [card.getBoundingClientRect().width]
      useGameStore().transitionToState(state)
      const started = performance.now()
      await new Promise((resolve) => {
        function sample() {
          samples.push(card.getBoundingClientRect().width)
          if (performance.now() - started < 700) requestAnimationFrame(sample)
          else resolve()
        }
        requestAnimationFrame(sample)
      })
      return samples
    }, state)
    const start = widths[0],
      end = widths.at(-1)
    assert.ok(Math.abs(start - end) > 2)
    assert.ok(
      widths.some((width) => width > Math.min(start, end) + 1 && width < Math.max(start, end) - 1),
      `${state}: card width must pass through intermediate sizes`,
    )
  }
  // Result feedback remains beside attempts when the card contracts after an answer.
  await setState('QUESTIONING')
  for (const result of ['incorrect', 'correct', null]) {
    await page.evaluate(async (result) => {
      const { useGameStore } = await import('/src/stores/gameStore.ts')
      useGameStore().answerResult = result
    }, result)
    await settle()
    if (result) {
      assert.equal(await page.locator('.answer-result').isVisible(), true)
      const fontSizes = () =>
        page.evaluate(() =>
          ['.attempts-counter', '.answer-result'].map(
            (selector) => getComputedStyle(document.querySelector(selector)).fontSize,
          ),
        )
      const compactFonts = await fontSizes()
      await setState('ANSWERING')
      await settle()
      assert.ok((await page.locator('.attempts-counter').textContent()).includes('解答残り'))
      assert.deepEqual(await fontSizes(), compactFonts, 'Font sizes must stay equal when expanded')
      const badgeAppearance = () =>
        page.locator('.answer-result').evaluate((el) => {
          const style = getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          return {
            width: rect.width,
            height: rect.height,
            padding: style.padding,
            lineHeight: style.lineHeight,
            fontSize: style.fontSize,
            radius: style.borderRadius,
          }
        })
      const expandedBadge = await badgeAppearance()
      await setState('QUESTIONING')
      const motion = await page.evaluate(async () => {
        const offsets = []
        const started = performance.now()
        await new Promise((resolve) => {
          function sample() {
            const group = document.querySelector('.answer-summary').getBoundingClientRect()
            const label = document.querySelector('.attempts-label').getBoundingClientRect()
            const badge = document.querySelector('.answer-result').getBoundingClientRect()
            offsets.push([
              label.left - group.left,
              group.right - badge.right,
              (label.top + label.bottom - badge.top - badge.bottom) / 2,
            ])
            if (performance.now() - started < 1750) requestAnimationFrame(sample)
            else resolve()
          }
          requestAnimationFrame(sample)
        })
        return offsets
      })
      assert.ok(
        motion.every((offsets) => offsets.every((offset) => Math.abs(offset) < 1)),
        'Summary elements must stay anchored to the same group throughout contraction',
      )
      assert.deepEqual(
        await badgeAppearance(),
        expandedBadge,
        'Badge must retain its expanded appearance',
      )
      const layout = await page.evaluate(() => {
        const rect = (s) => document.querySelector(s).getBoundingClientRect()
        const label = rect('.attempts-label'),
          badge = rect('.answer-result')
        const card = rect('.answer-area'),
          stage = rect('.button-stage')
        return {
          beside: badge.left >= label.right,
          inside: badge.right < card.right,
          sameRow: Math.abs((label.top + label.bottom) / 2 - (badge.top + badge.bottom) / 2) < 1,
          aligned: Math.abs(stage.top - card.bottom) < 1,
        }
      })
      assert.deepEqual(layout, { beside: true, inside: true, sameRow: true, aligned: true })
      const compactGap = await page.evaluate(() => {
        const label = document.querySelector('.attempts-label').getBoundingClientRect()
        const badge = document.querySelector('.answer-result').getBoundingClientRect()
        return [
          badge.left - label.right,
          parseFloat(getComputedStyle(document.documentElement).fontSize),
        ]
      })
      assert.ok(
        Math.abs(compactGap[0] - compactGap[1]) < 1,
        'Final compact spacing must remain 1rem',
      )
    } else assert.equal(await page.locator('.answer-result').count(), 0)
  }
  for (const theme of ['light', 'dark', 'neumorphism', 'flat']) {
    await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme)
    for (const [width, height] of [
      [1440, 900],
      [1200, 720],
      [1920, 1080],
      [1920, 1440],
      [1366, 600],
    ]) {
      await page.setViewportSize({ width, height })
      for (const model of ['2d', 'simple-round-v1', 'waseda-style-v1']) {
        await page.evaluate(async (model) => {
          const { useSettingsStore } = await import('/src/stores/settingsStore.ts')
          const store = useSettingsStore()
          store.setButtonMode(model === '2d' ? '2d' : '3d')
          if (model !== '2d') store.setButtonModel(model)
        }, model)
        await setState('QUESTIONING')
        await settle()
        const compact = await measure()
        if (model === '2d') {
          const ratio = await page.locator('.quiz-button').evaluate((el) => {
            const style = getComputedStyle(el)
            return parseFloat(style.fontSize) / parseFloat(style.width)
          })
          assert.ok(Math.abs(ratio - 0.1) < 0.001, '2D text is 10% of button diameter')
        }
        const stageTop =
          model === 'waseda-style-v1'
            ? await page
                .locator('.game-ui')
                .evaluate(
                  (el) =>
                    el.getBoundingClientRect().top +
                    2 * parseFloat(getComputedStyle(el).paddingTop),
                )
            : compact.panel.bottom
        assert.ok(
          Math.abs(compact.stage.top - stageTop) < 0.1,
          'Box stage has twice the lower area padding; other stages start below the card',
        )
        if (model === 'simple-round-v1') {
          const canvas = await page.locator('.button-3d').boundingBox()
          assert.ok(
            canvas.width <= 360 && canvas.height <= 360,
            'Round center reference keeps its limit',
          )
          assert.ok(Math.abs(canvas.width - Math.min(compact.stage.width * 0.6, 360)) < 1)
        }
        if (model !== '2d') {
          const canvas = await page.locator('.button-canvas canvas').boundingBox()
          const game = await page.locator('.game-ui').boundingBox()
          for (const dimension of ['x', 'y', 'width', 'height']) {
            assert.ok(Math.abs(canvas[dimension] - game[dimension]) < 1, 'Canvas covers game-ui')
          }
        }
        assert.ok((await page.locator('.attempts-counter').textContent()).includes('解答残り'))
        assert.equal(
          await page.locator('.answer-meta').evaluate((el) => getComputedStyle(el).textAlign),
          'center',
        )
        const grip = await page.locator('.resize-grip').first().boundingBox()
        const lower = await page.locator('.game-ui').boundingBox()
        assert.ok(
          Math.abs(grip.y + grip.height / 2 - (lower.y + lower.height / 2)) < 1,
          'Grip must be centered in the lower area',
        )
        assert.equal(grip.width, 6)
        assert.equal(grip.height, 64)
        assert.equal(await page.locator('.resize-grip svg').count(), 0)
        assert.ok(
          await page.locator('.answer-area').evaluate((el) => {
            const label = el.querySelector('.attempts-label').getBoundingClientRect()
            const style = getComputedStyle(el)
            const meta = getComputedStyle(el.querySelector('.answer-meta'))
            const padding =
              parseFloat(style.paddingLeft) +
              parseFloat(style.paddingRight) +
              parseFloat(meta.paddingLeft) +
              parseFloat(meta.paddingRight)
            return (
              Math.abs(el.getBoundingClientRect().width - label.width - padding - 2) < 1 &&
              Math.abs(
                parseFloat(style.borderTopLeftRadius) -
                  parseFloat(style.getPropertyValue('--radius-sm')) *
                    parseFloat(getComputedStyle(document.documentElement).fontSize),
              ) < 0.1
            )
          }),
          'Compact card must fit its text and use the shared small radius',
        )
        const availableHeight = await page
          .locator('.main-content')
          .evaluate((el) => el.getBoundingClientRect().height)
        const idealWidth = (((availableHeight * 13) / 25) * 16) / 9
        const rem = await page.evaluate(() =>
          parseFloat(getComputedStyle(document.documentElement).fontSize),
        )
        const maximum = Math.max(
          480,
          Math.min(width - 480, ((availableHeight - 16 * rem - 1) * 16) / 9),
        )
        const minimum = Math.min(640, maximum)
        const expectedVideoWidth = Math.min(
          maximum,
          Math.max(minimum, Math.min(idealWidth, width * 0.6)),
        )
        assert.ok(Math.abs(compact.video.width - expectedVideoWidth) < 0.1)
        if (idealWidth >= minimum && idealWidth <= Math.min(width * 0.6, maximum)) {
          const lower = await page.locator('.game-ui').boundingBox()
          assert.ok(
            Math.abs(compact.video.height / lower.height - 13 / 12) < 0.01,
            'Initial video and lower UI heights follow 13:12',
          )
        }
        const sidebar = await page.locator('.score-sidebar').boundingBox()
        assert.equal(sidebar.x + sidebar.width, width, 'Sidebar must reach the viewport edge')
        assert.ok(
          Math.abs(sidebar.width - (width - compact.video.width) / 2) < 0.1,
          'Both full side bands must have equal width',
        )
        const progressFits = await page.locator('.score-progress').evaluate((el) => {
          const sidebar = el.parentElement
          const style = getComputedStyle(sidebar)
          return (
            Math.abs(
              el.getBoundingClientRect().width -
                (sidebar.clientWidth -
                  parseFloat(style.paddingLeft) -
                  parseFloat(style.paddingRight)),
            ) < 1
          )
        })
        assert.ok(progressFits, 'Score card must fill the sidebar content width')
        assert.equal(await page.locator('.answer-input').isVisible(), false)
        const expansionFrames = await page.evaluate(async () => {
          const { useGameStore } = await import('/src/stores/gameStore.ts')
          const card = document.querySelector('.answer-area')
          const sample = () => {
            const style = getComputedStyle(card)
            return {
              width: parseFloat(style.width),
              top: parseFloat(style.top),
              right: parseFloat(style.right),
            }
          }
          const frames = [sample()]
          useGameStore().transitionToState('ANSWERING')
          const started = performance.now()
          await new Promise((resolve) => {
            function frame() {
              frames.push(sample())
              if (performance.now() - started < 750) requestAnimationFrame(frame)
              else resolve()
            }
            requestAnimationFrame(frame)
          })
          return frames
        })
        const first = expansionFrames[0],
          last = expansionFrames.at(-1)
        assert.ok(
          expansionFrames.some(
            (frame) => frame.width > first.width + 1 && frame.width < last.width - 1,
          ),
        )
        for (const frame of expansionFrames) {
          const widthProgress = (frame.width - first.width) / (last.width - first.width)
          const topProgress = (frame.top - first.top) / (last.top - first.top)
          assert.ok(
            Math.abs(widthProgress - topProgress) < 0.03,
            'Position and width must share the same progress',
          )
        }
        const nearEnd = expansionFrames.at(-4)
        assert.ok(
          Math.abs(nearEnd.right - last.right) < 1,
          'Horizontal placement must not keep chasing after expansion',
        )
        const expanded = await measure()
        const fonts = await page.evaluate(() => {
          const selectors = [
            '.answer-input',
            '.submit-button',
            '.attempts-counter',
            '.answer-timer',
            '.button-key-hint',
            '.check-toggle-label',
          ]
          return selectors.map((selector) =>
            parseFloat(getComputedStyle(document.querySelector(selector)).fontSize),
          )
        })
        assert.deepEqual(
          fonts,
          [16, 16, 16, 16, 12, 12],
          'Desktop text must not grow with viewport height',
        )
        assert.ok(!(await page.locator('.attempts-counter').textContent()).includes('解答回数'))
        assert.ok(Math.abs(expanded.video.width - expectedVideoWidth) < 0.1)
        assert.ok(expanded.panel.width > compact.panel.width)
        assert.ok(expanded.stage.width < compact.stage.width)
        const gaps = await page.evaluate(() => {
          const game = document.querySelector('.game-ui')
          const lower = game.getBoundingClientRect()
          const panel = document.querySelector('.answer-area').getBoundingClientRect()
          const stage = document.querySelector('.button-stage').getBoundingClientRect()
          const width = parseFloat(
            getComputedStyle(game).getPropertyValue('--desktop-button-width'),
          )
          const center = stage.left + stage.width / 2
          return [
            center - width / 2 - lower.left,
            panel.left - center - width / 2,
            lower.right - panel.right,
          ]
        })
        assert.ok(
          gaps.every((gap) => gap > 0),
          'Button and card must have space on all sides',
        )
        assert.ok(Math.max(...gaps) - Math.min(...gaps) < 2, `Uneven expanded gaps: ${gaps}`)
        assert.ok(expanded.input.bottom <= expanded.panel.bottom)
        assert.equal(expanded.focus, 'answer-input')
        if (height >= 600) assert.equal(expanded.scroll, 0)
        const toggle = page.locator('.display-mode-toggle')
        const toggleBox = await toggle.boundingBox()
        assert.equal(toggleBox.width, 44)
        assert.equal(toggleBox.height, 36)
        console.log(JSON.stringify({ theme, width, height, model, scroll: expanded.scroll }))
      }
    }
  }
  // The same mounted page switches layouts without duplicating the input/player.
  // Simulate 200% text scaling independently of layout rem units.
  await page.setViewportSize({ width: 1200, height: 900 })
  await setState('ANSWERING')
  await page.evaluate(async () => {
    const { useGameStore } = await import('/src/stores/gameStore.ts')
    useGameStore().answerResult = 'incorrect'
    document.querySelector('.game-ui').style.fontSize = '32px'
  })
  await page.waitForTimeout(1400)
  const enlarged = await page.evaluate(() => {
    const card = document.querySelector('.answer-area').getBoundingClientRect()
    const elements = [
      '.attempts-counter',
      '.answer-result',
      '.answer-timer',
      '.answer-input',
      '.submit-button',
    ].map((selector) => document.querySelector(selector))
    const bounds = elements.map((el) => el.getBoundingClientRect())
    return {
      fonts: elements.map((el) => parseFloat(getComputedStyle(el).fontSize)),
      inside: bounds.every(
        (r) => r.left >= card.left && r.right <= card.right && r.bottom <= card.bottom,
      ),
      overlap: bounds.some((a, i) =>
        bounds.some(
          (b, j) =>
            i < j &&
            Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1,
        ),
      ),
    }
  })
  assert.deepEqual(enlarged.fonts, [32, 32, 32, 32, 32])
  assert.equal(enlarged.inside, true, '200% text must remain inside the answer card')
  assert.equal(enlarged.overlap, false, '200% text must not overlap controls or feedback')
  await page.evaluate(async () => {
    document.querySelector('.game-ui').style.removeProperty('font-size')
    const { useGameStore } = await import('/src/stores/gameStore.ts')
    useGameStore().answerResult = null
  })
  for (const width of [1199, 1100, 960, 932, 880]) {
    await page.setViewportSize({ width, height: 900 })
    await settle()
    assert.equal(await page.locator('.score-sidebar').count(), 1)
    assert.equal(await page.locator('.desktop-resize-handle.left').isVisible(), false)
    assert.equal(await page.locator('.desktop-resize-handle.right').isVisible(), true)
    const video = await page.locator('.video-player-container').boundingBox()
    const sidebar = await page.locator('.score-sidebar').boundingBox()
    assert.equal(video.x, 0, 'Two-column video starts at the left edge')
    assert.ok(sidebar.width >= 240 && Math.abs(sidebar.x + sidebar.width - width) < 1)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width)
  }
  await page.setViewportSize({ width: 879, height: 900 })
  await settle()
  assert.equal(await page.locator('.score-sidebar').count(), 0)
  assert.equal(await page.locator('.answer-input').count(), 1)
  await page.setViewportSize({ width: 1440, height: 900 })
  await settle()
  assert.equal(await page.locator('.score-sidebar').count(), 1)
  await setState('QUESTIONING')
  // Settings drawer geometry, scrolling, and keyboard dismissal.
  for (const width of [1440, 1200, 1199, 960, 880, 879]) {
    await page.setViewportSize({ width, height: 600 })
    await page.getByRole('button', { name: '設定を開く' }).click()
    await settle()
    const dialog = page.getByRole('dialog', { name: '設定', exact: true })
    const box = await dialog.locator('.modal-container').boundingBox()
    if (width >= 880) {
      assert.ok(
        Math.abs(box.x + box.width - width) < 1,
        'Desktop settings attach to the right edge',
      )
      assert.equal(box.y, 0)
      assert.equal(box.height, 600)
    } else {
      assert.ok(Math.abs(box.x + box.width / 2 - width / 2) < 1, 'Mobile settings stay centered')
      assert.ok(box.y > 0)
    }
    assert.ok(
      await dialog.locator('.modal-content').evaluate((el) => {
        el.scrollTop = 100
        return el.scrollTop > 0
      }),
      'Settings content remains scrollable',
    )
    await page.keyboard.press('Escape')
    await settle()
    assert.equal(await dialog.count(), 0)
    assert.ok(
      await page.locator('.game-ui').evaluate((el) => el.contains(document.activeElement)),
      'Closing settings returns focus to game controls',
    )
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  // End settings drawer checks.
  await page.getByRole('button', { name: '設定を開く' }).click()
  await setState('ANSWERING')
  await settle()
  assert.notEqual((await measure()).focus, 'answer-input', 'Modal must retain focus')
  await page.getByRole('button', { name: '設定を閉じる' }).click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await setState('QUESTIONING')
  await setState('ANSWERING')
  await page.waitForTimeout(50)
  assert.equal((await measure()).focus, 'answer-input', 'Reduced motion must focus immediately')
  await page.evaluate(async () => {
    const { useGameStore } = await import('/src/stores/gameStore.ts')
    const store = useGameStore()
    store.$patch({
      results: Array.from({ length: 30 }, (_, index) => ({
        questionNumber: index + 1,
        isCorrect: true,
        correctAnswer: '確定済みの解答',
        userAnswers: ['解答'],
        skipped: false,
        timesUntilPress: [],
        submissionTypes: [],
      })),
    })
  })
  await settle()
  assert.ok(
    await page.locator('.sidebar-results').evaluate((el) => {
      el.scrollTop = 100
      return el.scrollTop > 0
    }),
    'Long results list must scroll',
  )
  await setState('QUESTIONING')
  await settle()
  const right = page.getByRole('separator', { name: '中央エリアの右境界' })
  const rightBox = await right.boundingBox()
  const original = (await measure()).video
  const gameArea = await page.locator('.game-ui').boundingBox()
  assert.ok(
    rightBox.y + rightBox.height >= gameArea.y + gameArea.height - 1,
    'Resize boundary must cover the lower game area',
  )
  assert.ok(await right.locator('.resize-grip').isVisible(), 'Resize grip must be visible')
  const dragY = rightBox.y + rightBox.height - 30
  await page.mouse.move(rightBox.x + 6, dragY)
  await page.mouse.down()
  await page.mouse.move(rightBox.x + 36, dragY, { steps: 5 })
  await page.mouse.up()
  await settle()
  const resized = (await measure()).video
  const maximumWidth = Number(await right.getAttribute('aria-valuemax'))
  assert.ok(
    Math.abs(resized.width - Math.min(original.width + 60, maximumWidth)) < 1,
    'Dragging changes width by twice the movement within the side-band limit',
  )
  assert.ok(Math.abs(resized.x + resized.width / 2 - 720) < 1, 'Video must stay centered')
  await right.press('Home')
  await settle()
  const narrow = (await measure()).video
  assert.equal(narrow.width, 640)
  assert.equal(narrow.x, 400)
  assert.ok(
    await page.locator('.score-progress').evaluate((el) => el.scrollWidth <= el.clientWidth),
    'Sidebar content must fit its width',
  )
  await right.press('End')
  await settle()
  assert.ok(Math.abs((await measure()).video.width - maximumWidth) < 1)
  assert.ok(
    await page.locator('.score-progress').evaluate((el) => el.scrollWidth <= el.clientWidth),
    'Sidebar must fit at minimum width',
  )
  await page.evaluate(async () => {
    const { useSettingsStore } = await import('/src/stores/settingsStore.ts')
    useSettingsStore().setButtonMode('3d')
    useSettingsStore().setButtonModel('waseda-style-v1')
  })
  await settle()
  let previousBoxWidth = 0
  for (let step = 0; step <= 16; step++) {
    const size = await page.locator('.game-ui').evaluate((el) => ({
      model: parseFloat(getComputedStyle(el).getPropertyValue('--desktop-button-width')),
      initial: parseFloat(getComputedStyle(el).getPropertyValue('--desktop-initial-width')),
    }))
    assert.ok(
      size.model + 0.2 >= previousBoxWidth,
      'Narrowing the video must not reverse box growth',
    )
    assert.ok(size.model <= size.initial * 0.25 + 0.1, 'Box cap uses initial width')
    previousBoxWidth = size.model
    if (step < 16) {
      await right.press('ArrowLeft')
      await settle()
    }
  }
  // 手動幅を維持したまま外側だけ狭めても、モデルの上限を縮めない。
  for (const model of ['waseda-style-v1', 'simple-round-v1']) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.evaluate(async (model) => {
      const { useSettingsStore } = await import('/src/stores/settingsStore.ts')
      useSettingsStore().setButtonModel(model)
    }, model)
    await settle()
    const readSize = () => page.locator('.game-ui').evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      model: parseFloat(getComputedStyle(el).getPropertyValue('--desktop-button-width')),
      initial: parseFloat(getComputedStyle(el).getPropertyValue('--desktop-initial-width')),
    }))
    const before = await readSize()
    await page.setViewportSize({ width: 1280, height: 900 })
    await settle()
    const after = await readSize()
    assert.equal(after.width, before.width, 'Central width stays fixed')
    assert.equal(after.initial, before.initial, 'Manual layout retains the model reference width')
    assert.ok(Math.abs(after.model - before.model) < 0.2, 'Model stays the same size')
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await settle()
  await setState('FINISHED')
  await settle()
  assert.equal(await page.locator('.result-ui').count(), 0)
  const replay = page.getByRole('button', { name: 'もう一度プレイ', exact: true })
  for (const selector of [
    '.button-stage',
    '.display-mode-toggle',
    '.button-key-hint',
    '.check-toggle',
  ]) {
    assert.ok(await page.locator(selector).isVisible(), `${selector} stays visible after finishing`)
  }
  assert.ok(await replay.isVisible())
  assert.equal(await replay.evaluate((el) => el.matches('button.answer-area.replay-card')), true)
  assert.ok(await page.locator('.sidebar-results').isVisible())
  assert.ok((await measure()).video.width > 0)
  const replayStyle = await replay.evaluate((el) => {
    const style = getComputedStyle(el)
    return [
      style.paddingTop,
      style.paddingRight,
      getComputedStyle(el.querySelector('.guide-text')).fontSize,
    ]
  })
  const rem = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).fontSize),
  )
  assert.ok(Math.abs(parseFloat(replayStyle[0]) - rem * 0.5) < 0.01)
  assert.ok(Math.abs(parseFloat(replayStyle[1]) - rem * 0.875) < 0.01)
  assert.equal(replayStyle[2], '16px')
  await page.setViewportSize({ width: 879, height: 900 })
  await settle()
  assert.ok(await page.locator('.result-ui').isVisible(), 'Mobile keeps its result screen')
  assert.equal(await page.locator('.replay-card').count(), 0)
  await page.setViewportSize({ width: 1440, height: 900 })
  await settle()
  await replay.focus()
  await replay.press('Enter')
  await settle()
  assert.equal(await page.locator('.replay-card').count(), 0)
  assert.equal(await page.locator('.guide-message').textContent(), 'ボタンを押してクイズを開始')
  // 境界を触らずブラウザ幅だけを狭める経路も、モデル上限を縮めない。
  for (const model of ['waseda-style-v1', 'simple-round-v1']) {
    await page.setViewportSize({ width: 1920, height: 1065 })
    await page.reload()
    await page.getByText('タップしてはじめる', { exact: true }).click()
    await page.evaluate(async (model) => {
      const { useSettingsStore } = await import('/src/stores/settingsStore.ts')
      useSettingsStore().setButtonMode('3d')
      useSettingsStore().setButtonModel(model)
      // ヘッダーのrem変化を切り離し、横幅だけの影響を検証する。
      Object.assign(document.querySelector('.main-content').style, { height: '980px', flex: 'none' })
    }, model)
    let previous = 0
    let reference
    for (const width of [1920, 1440, 1280, 1200, 1100, 968, 960]) {
      await page.setViewportSize({ width, height: 1065 })
      await settle()
      const size = await page.locator('.game-ui').evaluate((el) => ({
        model: parseFloat(getComputedStyle(el).getPropertyValue('--desktop-button-width')),
        reference: parseFloat(getComputedStyle(el).getPropertyValue('--desktop-initial-width')),
      }))
      reference ??= size.reference
      assert.equal(size.reference, reference, 'Automatic layout retains the height-based cap')
      assert.ok(size.model + 0.2 >= previous, `${model}: window narrowing must not lower the cap`)
      previous = size.model
    }
  }
  // PCの最小構成が縦に収まらない場合は、ドラッグ不可の縦長配置へ切り替える。
  await page.reload()
  await page.getByText('タップしてはじめる', { exact: true }).click()
  for (const [width, height] of [[1366, 500], [1024, 480], [960, 500], [880, 500], [879, 770], [800, 600], [600, 600]]) {
    await page.setViewportSize({ width, height })
    for (const model of ['2d', 'simple-round-v1', 'waseda-style-v1']) {
      await page.evaluate(async (model) => {
        const { useSettingsStore } = await import('/src/stores/settingsStore.ts')
        const settings = useSettingsStore()
        settings.setButtonMode(model === '2d' ? '2d' : '3d')
        if (model !== '2d') settings.setButtonModel(model)
      }, model)
      for (const state of ['QUESTIONING', 'ANSWERING']) {
        await setState(state)
        await settle()
        assert.equal(await page.locator('.portrait-fallback').count(), 1)
        assert.equal(await page.locator('.desktop-resize-handle').count(), 0)
        const bounds = await page.locator('.main-content').evaluate((el) => ({
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
          overflow: el.scrollHeight - el.clientHeight,
          horizontal: el.scrollWidth - el.clientWidth,
        }))
        assert.ok(Math.abs(bounds.width * 2 - bounds.height) < 1)
        assert.ok(bounds.overflow <= 1, JSON.stringify({ width, height, model, state, bounds }))
        assert.equal(bounds.horizontal, 0)
      }
    }
  }
  await page.getByRole('button', { name: '設定を開く' }).click()
  await settle()
  const compactSettings = page.getByRole('dialog', { name: '設定', exact: true })
  assert.ok(await compactSettings.locator('.modal-content').evaluate((el) => {
    el.scrollTop = 100
    return el.scrollTop > 0
  }), 'Settings retain necessary scrolling')
  await page.getByRole('button', { name: '設定を閉じる' }).click()
  await setState('FINISHED')
  await settle()
  assert.equal(await page.locator('.portrait-fallback').count(), 1)
  assert.ok(await page.locator('.result-ui').isVisible())
  await page.setViewportSize({ width: 1366, height: 700 })
  await settle()
  assert.equal(await page.locator('.portrait-fallback').count(), 0)
  assert.equal(await page.locator('.desktop-resize-handle').count(), 2)
  await page.setViewportSize({ width: 500, height: 900 })
  await settle()
  assert.equal(await page.locator('.portrait-fallback').count(), 0)
  assert.equal(await page.locator('.desktop-layout').count(), 0)
  await page.close()
} finally {
  await browser.close()
}
