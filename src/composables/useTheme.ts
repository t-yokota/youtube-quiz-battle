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
}

let initialized = false

function init(): void {
  if (initialized) return
  initialized = true

  themes.value = themeIds
    .map((id) => ({ id, ...readThemeMeta(id) }))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))

  const saved = localStorage.getItem(STORAGE_KEY)
  apply(saved !== null && themeIds.includes(saved) ? saved : DEFAULT_THEME)
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
