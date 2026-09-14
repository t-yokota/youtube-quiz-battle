export type ButtonMode = '2d' | '3d'
export type ButtonModelId = 'simple-round-v1' | 'waseda-style-v1'
export interface ButtonSettings {
  schemaVersion: 1
  renderMode: ButtonMode
  modelId: ButtonModelId
  appearancePresetId: 'original-v1'
}
export const defaultButton: Readonly<ButtonSettings> = Object.freeze({
  schemaVersion: 1,
  renderMode: '2d',
  modelId: 'simple-round-v1',
  appearancePresetId: 'original-v1',
})
export function isButtonModel(value: unknown): value is ButtonModelId {
  return value === 'simple-round-v1' || value === 'waseda-style-v1'
}
export function readButtonSettings(value: unknown): ButtonSettings {
  if (value && typeof value === 'object') {
    const saved = value as Partial<ButtonSettings>
    if (
      saved.schemaVersion === 1 &&
      isButtonModel(saved.modelId) &&
      (saved.renderMode === '2d' || saved.renderMode === '3d') &&
      saved.appearancePresetId === 'original-v1'
    ) {
      return { ...defaultButton, renderMode: saved.renderMode, modelId: saved.modelId }
    }
  }
  return { ...defaultButton }
}
