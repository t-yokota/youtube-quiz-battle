import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import { beforeEach, afterEach, expect, it } from 'vitest'
import SettingsModal from '../SettingsModal.vue'
import ThemeSwitcher from '@/components/theme/ThemeSwitcher.vue'
import OrientationDialog from '../OrientationDialog.vue'
import ErrorDialog from '../ErrorDialog.vue'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDebugStore } from '@/stores/debugStore'
import { quizFixture } from '@/__tests__/helpers/gameFixture'
let app: ReturnType<typeof createApp>
let host: HTMLElement
const settings = ref(false),
  theme = ref(false),
  orientation = ref(false),
  error = ref(false)
async function flush() {
  for (let i = 0; i < 6; i++) await nextTick()
}
function button(selector: string) {
  return document.querySelector<HTMLButtonElement>(selector)!
}
function escape() {
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  )
}
beforeEach(async () => {
  settings.value = theme.value = orientation.value = error.value = false
  localStorage.clear()
  const pinia = createPinia()
  host = document.createElement('div')
  document.body.append(host)
  app = createApp({
    setup() {
      const game = useGameStore()
      game.setQuizData(quizFixture({ debug: true }))
      const prefs = useSettingsStore()
      return () =>
        h('div', [
          h(
            'button',
            {
              id: 'opener',
              'data-dialog-return-focus': '',
              onClick: () => (settings.value = true),
            },
            '設定',
          ),
          h(SettingsModal, {
            isOpen: settings.value,
            volumeLevel: prefs.volumeLevel,
            onClose: () => (settings.value = false),
            onUpdateVolume: prefs.setVolumeLevel,
            onOpenThemeSwitcher: () => {
              settings.value = false
              theme.value = true
            },
          }),
          h(ThemeSwitcher, { isOpen: theme.value, onClose: () => (theme.value = false) }),
          h(OrientationDialog, { isOpen: orientation.value }),
          h(ErrorDialog, { isOpen: error.value, showClose: false }),
        ])
    },
  })
  app.use(pinia)
  app.mount(host)
  await flush()
})
afterEach(() => {
  app.unmount()
  host.remove()
  document.querySelectorAll('[role="dialog"], .zoom-layer').forEach((element) => element.remove())
})
it('設定→テーマ→閉じるで元の設定ボタンへ戻り、横画面警告が最前面を保つ', async () => {
  const opener = button('#opener')
  opener.focus()
  opener.click()
  await flush()
  expect(document.activeElement?.getAttribute('aria-label')).toBe('設定を閉じる')
  button('.theme-button').focus()
  button('.theme-button').click()
  await flush()
  expect(document.activeElement?.classList.contains('card')).toBe(true)
  const card = document.activeElement
  orientation.value = true
  await flush()
  expect(document.activeElement?.textContent).toContain('画面を縦向きにしてください')
  escape()
  await flush()
  expect(orientation.value).toBe(true)
  expect(theme.value).toBe(true)
  orientation.value = false
  await flush()
  expect(document.activeElement).toBe(card)
  escape()
  await flush()
  expect(theme.value).toBe(false)
  expect(document.activeElement).toBe(opener)
})
it('閉じられないエラーは設定より前面で操作を保持する', async () => {
  button('#opener').click()
  await flush()
  error.value = true
  await flush()
  expect(document.activeElement?.textContent).toContain('再読み込み')
  escape()
  await flush()
  expect(error.value).toBe(true)
  expect(settings.value).toBe(true)
  button('.modal-overlay .primary-button').click()
  await flush()
  expect(settings.value).toBe(true)
})
it('一般設定とデバッグ設定の値・順序・リセットを維持する', async () => {
  button('#opener').click()
  await flush()
  const range = document.querySelector<HTMLInputElement>('.slider')!
  range.value = '1'
  range.dispatchEvent(new Event('input', { bubbles: true }))
  await flush()
  expect(useSettingsStore().volumeLevel).toBe(1)
  button('[aria-label="シークバーの操作を許可する"]').click()
  await flush()
  expect(useSettingsStore().disableSeekbarOverride).toBe(false)
  button('[aria-label="デバッグメニュー"]').click()
  await flush()
  const number = document.querySelector<HTMLInputElement>('.debug-input')!
  number.value = '25'
  number.dispatchEvent(new Event('change', { bubbles: true }))
  await flush()
  expect(useDebugStore().answerTimeLimitOverride).toBe(25)
  button('[aria-label="正解発表ジャンプ"]').click()
  await flush()
  expect(useDebugStore().jumpToRevealPeriodOverride).toBe(true)
  const sections = [...document.querySelectorAll('.settings-section')]
  expect(sections.slice(-3).map((section) => section.textContent)).toEqual([
    expect.stringContaining('UIテーマ'),
    expect.stringContaining('デバッグ'),
    expect.stringContaining('データ収集について'),
  ])
  button('.debug-reset-button').click()
  await flush()
  expect(useDebugStore().answerTimeLimitOverride).toBeNull()
  expect(number.value).toBe('10')
})
