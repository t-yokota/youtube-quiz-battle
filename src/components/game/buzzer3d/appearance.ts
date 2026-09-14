// ADDON.mdの採用値。r128の線形値だった台座・発光色はモデル側で変換を戻す。
export const appearance = Object.freeze({
  capColor: '#b90008',
  baseColor: '#050505',
  glowColor: '#ff0800',
  glowIntensity: 0.65,
  capRoughness: 0.3,
  caseRadius: 0.06,
  caseRoughness: 0.5,
  caseMetalness: 0.2,
  lampColor: '#e32808',
  hemisphereIntensity: 0.65,
  keyIntensity: 0.95,
  rimIntensity: 0.55,
})
export type Appearance = typeof appearance
