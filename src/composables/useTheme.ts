// UIテーマの読込・適用・永続化
//
// CSSファイルとthemeMetaの両方に存在するテーマだけを公開する。
// - import.meta.glob がビルド時に themes/ を走査して全テーマCSSをバンドル
// - themeMeta がスイッチャーへ公開するID・表示名・並び順を一元管理
import { ref, computed } from 'vue'
import { createThemeList, type ThemeInfo } from '@/themes/themeMeta'

export type { ThemeInfo } from '@/themes/themeMeta'

// eager: true で全テーマCSSを即時 import（<style> として注入される）
const themeModules = import.meta.glob('../themes/*.theme.css', { eager: true })

const STORAGE_KEY = 'yqb-theme'
const DEFAULT_THEME = 'default'
const LEGACY_THEME_IDS: Readonly<Record<string, string>> = {
  'default-flat': 'flat',
}

const themes = ref<ThemeInfo[]>(createThemeList(Object.keys(themeModules)))
const themeIds = themes.value.map(({ id }) => id)
const currentThemeId = ref<string>(DEFAULT_THEME)

function apply(id: string): void {
  currentThemeId.value = id
  document.documentElement.dataset.theme = id

  const themeColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--theme-color')
    .trim()
  if (themeColor === '') return

  // アプリ内テーマはOSの配色設定とは独立しているため、mediaなしのmetaを1つだけ置く。
  // 要素自体を差し替え、動的なcontent変更を反映しないブラウザにも再評価させる。
  const existingMetas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
  const nextMeta = document.createElement('meta')
  nextMeta.name = 'theme-color'
  nextMeta.content = themeColor

  if (existingMetas[0]) {
    existingMetas[0].replaceWith(nextMeta)
    existingMetas.slice(1).forEach((meta) => meta.remove())
  } else {
    document.head.appendChild(nextMeta)
  }
}

let initialized = false

function init(): void {
  if (initialized) return
  initialized = true

  const saved = localStorage.getItem(STORAGE_KEY)
  const normalizedSaved = saved === null ? null : (LEGACY_THEME_IDS[saved] ?? saved)
  const initialTheme =
    normalizedSaved !== null && themeIds.includes(normalizedSaved) ? normalizedSaved : DEFAULT_THEME
  apply(initialTheme)

  // 改名・削除済みテーマなどの古い保存値を、次回以降も有効なIDへ正規化する。
  if (saved !== null && saved !== initialTheme) {
    localStorage.setItem(STORAGE_KEY, initialTheme)
  }
}

export function useTheme() {
  init()

  function setTheme(id: string): void {
    if (!themeIds.includes(id)) return
    apply(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  return {
    themes: computed(() => themes.value),
    currentThemeId: computed(() => currentThemeId.value),
    setTheme,
  }
}
