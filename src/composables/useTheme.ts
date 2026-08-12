// UIテーマの自動検出・適用・永続化
//
// src/themes/*.theme.css を追加するだけでテーマが増える。
// - import.meta.glob がビルド時に themes/ を走査して全テーマCSSをバンドル
// - テーマIDはファイル名（<id>.theme.css）から導出
// - 表示名・並び順はCSS内の --theme-label / --theme-order を実行時に読む
// → スイッチャー側のメンテ工数ゼロ
import { ref, computed } from 'vue'

// eager: true で全テーマCSSを即時 import（<style> として注入される）
const themeModules = import.meta.glob('../themes/*.theme.css', { eager: true })

const STORAGE_KEY = 'yqb-theme'
const DEFAULT_THEME = 'default'
const LEGACY_THEME_IDS: Readonly<Record<string, string>> = {
  'default-flat': 'flat',
}

export interface ThemeInfo {
  id: string
  label: string
  order: number
}

const themeIds = Object.keys(themeModules)
  .map((path) => /([^/]+)\.theme\.css$/.exec(path)?.[1])
  .filter((id): id is string => id !== undefined)

const themes = ref<ThemeInfo[]>([])
const currentThemeId = ref<string>(DEFAULT_THEME)

// テーマCSSの [data-theme] セレクタを probe 要素に当てて、メタ情報を読み取る
function readThemeMeta(id: string): { label: string; order: number } {
  const probe = document.createElement('div')
  probe.dataset.theme = id
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const style = getComputedStyle(probe)
  const label =
    style
      .getPropertyValue('--theme-label')
      .trim()
      .replace(/^['"]|['"]$/g, '') || id
  const order = Number(style.getPropertyValue('--theme-order')) || 0
  probe.remove()
  return { label, order }
}

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

  themes.value = themeIds
    .map((id) => ({ id, ...readThemeMeta(id) }))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))

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
