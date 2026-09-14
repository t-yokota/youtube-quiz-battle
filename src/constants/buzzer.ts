export type BuzzerMode = '2d' | '3d'
export type BuzzerModelId = 'simple-round-v1' | 'waseda-style-v1'
export interface BuzzerSettings {
  schemaVersion: 1
  renderMode: BuzzerMode
  modelId: BuzzerModelId
  appearancePresetId: 'original-v1'
}
export const defaultBuzzer: Readonly<BuzzerSettings> = Object.freeze({
  schemaVersion: 1,
  renderMode: '2d',
  modelId: 'simple-round-v1',
  appearancePresetId: 'original-v1',
})
export function isBuzzerModel(value: unknown): value is BuzzerModelId {
  return value === 'simple-round-v1' || value === 'waseda-style-v1'
}
export function readBuzzerSettings(value: unknown): BuzzerSettings {
  if (value && typeof value === 'object') {
    const saved = value as Partial<BuzzerSettings>
    if (
      saved.schemaVersion === 1 &&
      isBuzzerModel(saved.modelId) &&
      (saved.renderMode === '2d' || saved.renderMode === '3d') &&
      saved.appearancePresetId === 'original-v1'
    ) {
      return { ...defaultBuzzer, renderMode: saved.renderMode, modelId: saved.modelId }
    }
  }
  return { ...defaultBuzzer }
}
