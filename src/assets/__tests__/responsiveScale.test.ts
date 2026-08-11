import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(file: string): string {
  return readFileSync(resolve(process.cwd(), file), 'utf8')
}

function selectorBlock(source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const block = source.match(new RegExp(`^\\s*${escapedSelector}\\s*\\{([^}]*)\\}`, 'ms'))?.[1]

  if (!block) throw new Error(`${selector} is not defined`)

  return block
}

function normalizeCssValue(value: string | undefined): string | undefined {
  return value?.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
}

describe('実画面のレスポンシブスケール', () => {
  const mainStyles = readSource('src/assets/main.css')
  const app = readSource('src/App.vue')
  const appHeader = readSource('src/components/common/AppHeader.vue')
  const videoPlayer = readSource('src/components/common/VideoPlayer.vue')
  const gameInfo = readSource('src/components/game/GameInfo.vue')
  const guideText = readSource('src/components/game/GuideText.vue')
  const answerContent = readSource('src/components/game/AnswerContent.vue')
  const quizButton = readSource('src/components/game/QuizButton.vue')
  const finalScore = readSource('src/components/result/FinalScore.vue')
  const resultTable = readSource('src/components/result/ResultTable.vue')
  const resultActions = readSource('src/components/result/ResultActions.vue')
  const themePreview = readSource('src/components/theme/ThemePreview.vue')
  const themeSwitcher = readSource('src/components/theme/ThemeSwitcher.vue')
  const resultScreens = [finalScore, resultTable, resultActions]
  const deferredScreens = [
    'src/components/dialogs/SettingsModal.vue',
    'src/components/dialogs/LoadingDialog.vue',
    'src/components/dialogs/ErrorDialog.vue',
    'src/components/dialogs/OrientationDialog.vue',
  ].map(readSource)

  it('レイアウトと文字を短辺基準で縮尺し、文字だけ16pxの下限を保つ', () => {
    const htmlRule = selectorBlock(mainStyles, 'html')
    const layoutUnit = htmlRule.match(/--ui-layout-unit:\s*([^;]+);/)?.[1]
    const fontUnit = htmlRule.match(/--ui-font-unit:\s*([^;]+);/)?.[1]
    const widthUnit = htmlRule.match(/--ui-width-unit:\s*([^;]+);/)?.[1]

    expect(htmlRule).toContain('--ui-viewport-height: 100dvh')
    expect(normalizeCssValue(layoutUnit)).toBe(
      'clamp(13px, calc(min(var(--ui-viewport-height) / 700, 100vw / 315) * 16), 26px)',
    )
    expect(normalizeCssValue(fontUnit)).toBe(
      'clamp(16px, calc(min(var(--ui-viewport-height) / 700, 100vw / 315) * 16), 26px)',
    )
    expect(widthUnit).toBe('clamp(13px, calc(100vw / 315 * 16), 26px)')
    expect(htmlRule).toContain('font-size: var(--ui-layout-unit)')
    expect(selectorBlock(app, '.app-container')).toContain('height: var(--ui-viewport-height)')
  })

  it('WebKitがブラウザUI色を導出できるようルート背景へtheme-colorを適用する', () => {
    const rootCanvas = selectorBlock(mainStyles, 'html,\nbody')

    expect(rootCanvas).toContain('background-color: var(--theme-color)')
  })

  it('開始画面とゲーム本体の文字だけを独立した文字unitへ移す', () => {
    expect(selectorBlock(app, '.start-gate-action')).toContain(
      'font-size: calc(0.9375 * var(--ui-font-unit))',
    )
    expect(selectorBlock(appHeader, '.wordmark')).toContain(
      'font-size: calc(0.8125 * var(--ui-font-unit))',
    )
    expect(selectorBlock(videoPlayer, '.placeholder-text')).toContain(
      'font-size: calc(1.25 * var(--ui-font-unit))',
    )
    expect(selectorBlock(gameInfo, '.progress')).toContain(
      'font-size: calc(1.0625 * var(--ui-font-unit))',
    )
    expect(selectorBlock(guideText, '.guide-text')).toContain(
      'font-size: calc(0.875 * var(--ui-font-unit))',
    )
    expect(selectorBlock(answerContent, '.answer-timer')).toContain(
      'font-size: calc(0.8 * var(--ui-font-unit))',
    )
    expect(selectorBlock(quizButton, '.quiz-button')).toContain(
      'font-size: calc(1.1875 * var(--ui-font-unit))',
    )
  })

  it('開始ゲートのコンセプト画像をアクセント単色と白下地付きで切り替えられる', () => {
    const concept = selectorBlock(app, '.start-gate-concept')
    const accentOnly = selectorBlock(app, '.start-gate-concept--accent-only::before')
    const whiteFill = selectorBlock(app, '.start-gate-concept--white-fill::before')
    const underlay = selectorBlock(app, '.start-gate-concept::before')
    const mainArtwork = selectorBlock(app, '.start-gate-concept::after')
    const conceptRules = [concept, accentOnly, whiteFill, underlay, mainArtwork].join('\n')
    const accentSvg = readSource('public/quiz-battle-concept-mc.svg')
    const underlaySvg = readSource('public/quiz-battle-concept-white-fill.svg')
    const pathCount = (svg: string) => [...svg.matchAll(/<path\b/g)].length
    const viewBox = (svg: string) => svg.match(/\bviewBox="([^"]+)"/)?.[1]

    expect(existsSync(resolve(process.cwd(), 'public/quiz-battle-concept-mc.svg'))).toBe(true)
    expect(
      existsSync(resolve(process.cwd(), 'public/quiz-battle-concept-white-fill.svg')),
    ).toBe(true)
    expect(pathCount(accentSvg)).toBe(19)
    expect(pathCount(underlaySvg)).toBe(19)
    expect(viewBox(accentSvg)).toBe('0 0 5225 5225')
    expect(viewBox(underlaySvg)).toBe(viewBox(accentSvg))
    expect(app).toContain(
      "type StartGateConceptStyle = 'accent-only' | 'white-fill'",
    )
    expect(app).toMatch(
      /const START_GATE_CONCEPT_STYLE: StartGateConceptStyle = '(?:accent-only|white-fill)'/,
    )
    expect(app).toMatch(
      /class="start-gate-concept"\s+:class="`start-gate-concept--\$\{START_GATE_CONCEPT_STYLE\}`"\s+aria-hidden="true"/,
    )
    expect(concept).toContain('width: min(50%, calc(var(--ui-viewport-height) * 0.45))')
    expect(accentOnly).toContain('display: none')
    expect(whiteFill).toContain('display: block')
    expect(underlay).toContain('background-color: #fff')
    expect(conceptRules).not.toContain('filter:')
    expect(conceptRules).not.toContain('drop-shadow(')
    expect(conceptRules).not.toContain('--_concept-')
    expect(underlay).toContain(
      "-webkit-mask: url('/quiz-battle-concept-white-fill.svg') center / contain no-repeat",
    )
    expect(underlay).toContain(
      "mask: url('/quiz-battle-concept-white-fill.svg') center / contain no-repeat",
    )
    expect(mainArtwork).toContain('background-color: var(--color-accent)')
    expect(mainArtwork).toContain(
      "-webkit-mask: url('/quiz-battle-concept-mc.svg') center / contain no-repeat",
    )
    expect(mainArtwork).toContain(
      "mask: url('/quiz-battle-concept-mc.svg') center / contain no-repeat",
    )
  })

  it('評価対象外のダイアログには文字unitを適用しない', () => {
    for (const source of deferredScreens) {
      expect(source).not.toContain('--ui-font-unit')
    }
  })

  it('テーマスイッチャーの文字を実画面と同じ文字unitへ移し、見出しの下限を保つ', () => {
    expect(selectorBlock(themeSwitcher, '.switcher-title')).toContain(
      'font-size: max(15px, calc(0.8125 * var(--ui-font-unit)))',
    )
    expect(selectorBlock(themeSwitcher, '.switcher-hint')).toContain(
      'font-size: max(12px, calc(0.6875 * var(--ui-font-unit)))',
    )
    expect(selectorBlock(themeSwitcher, '.card-label')).toContain(
      'font-size: calc(0.6875 * var(--ui-font-unit))',
    )
    expect(selectorBlock(themeSwitcher, '.switcher-dismiss')).toContain(
      'font-size: calc(0.625 * var(--ui-font-unit))',
    )
  })

  it('テーマプレビューの文字を実画面と同じ文字unitへ移す', () => {
    const expectedSizes = [
      ['.p-wordmark', 'calc(0.8125 * var(--ui-font-unit))'],
      ['.p-progress', 'calc(1.0625 * var(--ui-font-unit))'],
      ['.p-q', 'calc(0.9375 * var(--ui-font-unit))'],
      ['.p-total', 'calc(0.75 * var(--ui-font-unit))'],
      ['.p-meta', 'calc(0.8 * var(--ui-font-unit))'],
      ['.p-input', 'max(16px, var(--ui-font-unit))'],
      ['.p-submit', 'calc(0.9375 * var(--ui-font-unit))'],
      ['.p-quiz-button', 'calc(1.1875 * var(--ui-font-unit))'],
      ['.p-toggle-label', 'calc(0.625 * var(--ui-font-unit))'],
      ['.p-toggle-state', 'calc(0.5 * var(--ui-font-unit))'],
    ] as const

    for (const [selector, size] of expectedSizes) {
      expect(selectorBlock(themePreview, selector)).toContain(`font-size: ${size}`)
    }
  })

  it('テーマプレビューのchip・早押しボタン・トグル寸法を実画面のunitへ揃える', () => {
    const chips = selectorBlock(themePreview, '.p-chips')
    const chip = selectorBlock(themePreview, '.p-chip')
    const buttonContainer = selectorBlock(themePreview, '.p-button-container')
    const pedestal = selectorBlock(themePreview, '.p-pedestal')
    const quizButton = selectorBlock(themePreview, '.p-quiz-button')
    const toggleRow = selectorBlock(themePreview, '.p-toggle-row')
    const toggle = selectorBlock(themePreview, '.p-toggle')
    const toggleState = selectorBlock(themePreview, '.p-toggle-state')
    const toggleKnob = selectorBlock(themePreview, '.p-toggle-knob')

    expect(chips).toContain('--preview-chip-unit: var(--ui-width-unit)')
    expect(chips).toContain('gap: calc(0.3125 * var(--preview-chip-unit))')
    expect(chip).toContain('width: var(--preview-chip-unit)')
    expect(chip).toContain('height: var(--preview-chip-unit)')
    expect(buttonContainer).toContain('min-height: 13.5rem')
    expect(pedestal).toContain('width: 12.25rem')
    expect(pedestal).toContain('height: 12.25rem')
    expect(quizButton).toContain('width: 9.375rem')
    expect(quizButton).toContain('height: 9.375rem')
    expect(themePreview).not.toContain('cqmin')
    expect(toggleRow).toContain('--preview-toggle-unit: var(--ui-font-unit)')
    expect(toggle).toContain('width: calc(2.75 * var(--preview-toggle-unit))')
    expect(toggle).toContain('height: calc(1.25 * var(--preview-toggle-unit))')
    expect(toggleState).toContain('left: calc(0.3125 * var(--preview-toggle-unit))')
    expect(toggleKnob).toContain('width: calc(0.9375 * var(--preview-toggle-unit))')
    expect(toggleKnob).toContain('height: calc(0.9375 * var(--preview-toggle-unit))')
    expect(toggleKnob).toContain('right: calc(0.125 * var(--preview-toggle-unit))')
  })

  it('テーマプレビューの主要レイアウト寸法を実画面と同じlayout unitへ揃える', () => {
    expect(selectorBlock(themePreview, '.p-header')).toContain(
      'padding: 0.625rem 0.75rem 0.5rem',
    )
    expect(selectorBlock(themePreview, '.p-settings-button')).toContain(
      'width: max(44px, 2.75rem)',
    )
    expect(selectorBlock(themePreview, '.p-settings-button')).toContain(
      'height: max(44px, 2.75rem)',
    )
    expect(selectorBlock(themePreview, '.p-settings-button')).toContain(
      'margin: -0.625rem calc((max(44px, 2.75rem) - 1.5rem) / -2) -0.625rem 0',
    )
    expect(selectorBlock(themePreview, '.p-gear')).toContain('width: 1.5rem')
    expect(selectorBlock(themePreview, '.p-scoreboard')).toContain(
      'padding: 0.625rem 0.875rem',
    )
    expect(selectorBlock(themePreview, '.p-game')).toContain('gap: 0.875rem')
    expect(selectorBlock(themePreview, '.p-game')).toContain('padding: 0.875rem 0.75rem')
    expect(selectorBlock(themePreview, '.p-panel')).toContain('height: 6.875rem')
    expect(selectorBlock(themePreview, '.p-panel')).toContain('padding: 0.75rem 0.875rem')
    expect(selectorBlock(themePreview, '.p-input')).toContain('height: max(44px, 2.75rem)')
    expect(selectorBlock(themePreview, '.p-submit')).toContain('height: max(44px, 2.75rem)')
    expect(themePreview).toMatch(
      /@media\s*\(max-height:\s*640px\)\s*{[\s\S]*?\.p-game\s*{[^}]*gap:\s*0\.625rem;[^}]*padding:\s*0\.625rem 0\.75rem;/,
    )
  })

  it('リザルト画面の文字全体を独立した文字unitへ移す', () => {
    expect(selectorBlock(finalScore, '.final-title')).toContain(
      'font-size: calc(0.8125 * var(--ui-font-unit))',
    )
    expect(selectorBlock(finalScore, '.final-score .num')).toContain(
      'font-size: calc(3.5 * var(--ui-font-unit))',
    )
    expect(selectorBlock(finalScore, '.final-score .den')).toContain(
      'font-size: calc(1.25 * var(--ui-font-unit))',
    )
    expect(selectorBlock(finalScore, '.final-rate')).toContain(
      'font-size: calc(0.8125 * var(--ui-font-unit))',
    )
    expect(selectorBlock(resultTable, '.result-row')).toContain(
      'font-size: calc(0.75 * var(--ui-font-unit))',
    )
    expect(selectorBlock(resultTable, '.result-row .yours')).toContain(
      'font-size: calc(0.6875 * var(--ui-font-unit))',
    )
    expect(selectorBlock(resultTable, '.result-row .qno')).toContain(
      'font-size: calc(0.625 * var(--ui-font-unit))',
    )
    expect(selectorBlock(resultActions, '.replay-button')).toContain(
      'font-size: var(--ui-font-unit)',
    )

    for (const source of resultScreens) {
      const fontSizes = [...source.matchAll(/font-size:\s*([^;]+);/g)].map((match) => match[1])
      expect(fontSizes.length).toBeGreaterThan(0)
      expect(fontSizes.every((value) => value.includes('var(--ui-font-unit)'))).toBe(true)
    }
  })

  it('リザルト画面の余白・行・○×チップ寸法はlayout remのまま維持する', () => {
    expect(selectorBlock(app, '.result-ui')).toContain('padding: 1.75rem 1.125rem 1.125rem')
    expect(selectorBlock(resultTable, '.result-row')).toContain('gap: 0.625rem')
    expect(selectorBlock(resultTable, '.result-row .mark')).toContain('width: 1.5rem')
    expect(selectorBlock(resultTable, '.result-row .mark')).toContain('height: 1.5rem')
    expect(selectorBlock(resultActions, '.replay-button')).toContain('height: max(44px, 3rem)')
  })

  it('文字を分離してもパネル・リング・ボタンの寸法はlayout remで縮尺する', () => {
    expect(selectorBlock(gameInfo, '.game-info')).toContain('padding: 0.625rem 0.875rem')
    expect(selectorBlock(answerContent, '.timer-ring')).toContain('width: 1.375rem')
    expect(selectorBlock(answerContent, '.timer-ring')).toContain('height: 1.375rem')
    expect(selectorBlock(quizButton, '.quiz-button')).toContain('width: 9.375rem')
    expect(selectorBlock(quizButton, '.quiz-button')).toContain('height: 9.375rem')
  })

  it('ゲーム中のscore-chipsは横幅基準のサイズを維持する', () => {
    const scoreChipsRule = selectorBlock(gameInfo, '.score-chips')
    const chipRule = selectorBlock(gameInfo, '.score-chips :deep(.chip)')
    const navRule = selectorBlock(gameInfo, '.chips-nav')
    const navIconRule = selectorBlock(gameInfo, '.chips-nav svg')

    expect(scoreChipsRule).toContain('--score-chip-unit: var(--ui-width-unit)')
    expect(scoreChipsRule).toContain('gap: calc(0.3125 * var(--score-chip-unit))')
    expect(chipRule).toContain('width: var(--score-chip-unit)')
    expect(chipRule).toContain('height: var(--score-chip-unit)')
    expect(navRule).toContain('width: calc(0.875 * var(--score-chip-unit))')
    expect(navRule).toContain('height: var(--score-chip-unit)')
    expect(navIconRule).toContain('width: calc(0.4375 * var(--score-chip-unit))')
    expect(navIconRule).toContain('height: calc(0.5625 * var(--score-chip-unit))')
  })

  it('入力文字は独立unitを使いながらiOSの16px下限を維持する', () => {
    expect(selectorBlock(answerContent, '.answer-input')).toContain(
      'font-size: max(16px, var(--ui-font-unit))',
    )
  })
})
