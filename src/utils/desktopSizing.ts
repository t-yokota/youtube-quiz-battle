/** CSSの下段最小高16remと動画下辺1pxを先に予約する。 */
export function desktopSizing(width: number, height: number, rem: number) {
  const sidebar = width < 1200 ? 240 : 480
  const heightLimit = ((height - 16 * rem - 1) * 16) / 9
  // PC配置の解答欄は480pxを下限とし、それでも高さ不足なら縦長表示へ切り替える。
  const maximum = Math.max(480, Math.min(width - sidebar, heightLimit))
  const minimum = Math.min(640, maximum)
  const initial = Math.min(
    maximum,
    Math.max(minimum, Math.min((((height * 13) / 25) * 16) / 9, width * 0.6)),
  )
  // モデル上限には横幅の制約を入れない。自動配置で中央が狭まっても、
  // 上限自体は縮めず、実際に収まるかどうかは3Dのカメラ計算に委ねる。
  const modelReference = Math.max(480, (((height * 13) / 25) * 16) / 9)
  // 表示結果のscrollHeightで判定すると、切替後に解消して往復する。
  // 通常のPC配置に必要な高さで判定し、復帰条件も同じにする。
  const needsPortrait = height < (480 * 9) / 16 + 1 + 16 * rem
  return { minimum, maximum, initial, modelReference, needsPortrait }
}

/** 代替表示の幅ではなく、左右余白を除く前のウインドウ幅で判定する。 */
export function needsPortraitLayout(width: number, height: number, rem: number) {
  if (width >= 880) return desktopSizing(width, height, rem).needsPortrait
  // 縦積みの動画16:9、進行表示3.25rem、解答欄6.875rem、
  // game-uiの上下余白とgap 2.625rem、3Dを含むボタンの最低高を予約する。
  const stackedHeight = (width * 9) / 16 + 1 + 12.75 * rem + Math.max(118, 7 * rem)
  return height < stackedHeight
}
