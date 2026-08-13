export interface ThemeInfo {
  id: string
  label: string
  order: number
}

export interface ThemeMetadata {
  label: string
  order: number
}

export type ThemeMetadataMap = Readonly<Record<string, Readonly<ThemeMetadata>>>

export const themeMeta = {
  default: { label: 'デフォルト', order: 0 },
  light: { label: 'ライト', order: 1 },
  flat: { label: 'フラット', order: 2 },
  neumorphism: { label: 'ニューモーフィズム', order: 3 },
} as const satisfies ThemeMetadataMap

export function createThemeList(
  themePaths: readonly string[],
  metadata: ThemeMetadataMap = themeMeta,
): ThemeInfo[] {
  const availableThemeIds = new Set(
    themePaths
      .map((path) => /([^/]+)\.theme\.css$/.exec(path)?.[1])
      .filter((id): id is string => id !== undefined),
  )

  return Object.entries(metadata)
    .filter(([id]) => availableThemeIds.has(id))
    .map(([id, meta]) => ({ id, ...meta }))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}
