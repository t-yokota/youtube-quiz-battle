// ボタン状態の定義
export enum ButtonState {
  STANDBY = 'STANDBY', // 待機状態（ボタンのデフォルト状態）
  PUSHED = 'PUSHED', // 押下状態（ボタンが押された状態）
  RELEASED = 'RELEASED', // 点灯状態（ボタンのLEDが点灯した状態、解答権取得）
  DISABLED = 'DISABLED', // 無効状態（ボタン押下が無効の状態）
}
