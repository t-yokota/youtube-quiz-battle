// 音声管理システムに関する定数

/**
 * 効果音の種類
 */
export enum SOUND_TYPE {
  BUTTON = 'button', // ボタン押下音
  CORRECT = 'correct', // 正解音
  INCORRECT = 'incorrect', // 不正解音
}

/**
 * 音声スプライトの区間定義（秒）
 * 実ファイル（8.125s / mono 48kHz）のスプライト位置に合わせて定義
 */
export const DEFAULT_AUDIO_SPRITE = {
  // BASE_URL 前置: GitHub Pages のサブパス配信に対応（末尾スラッシュ付き）
  src: `${import.meta.env.BASE_URL}assets/sounds/quiz-sounds.mp3`,
  sprite: {
    [SOUND_TYPE.BUTTON]: { start: 0, duration: 2.0 },
    [SOUND_TYPE.CORRECT]: { start: 3.0, duration: 2.0 },
    [SOUND_TYPE.INCORRECT]: { start: 6.0, duration: 2.0 },
  },
}

/**
 * 効果音の個別ファイル（HTMLAudio 経路用。スプライトのシーク遅延を避けるため音ごとに分割）
 */
export const SOUND_FILES: Record<SOUND_TYPE, string> = {
  [SOUND_TYPE.BUTTON]: `${import.meta.env.BASE_URL}assets/sounds/button.wav`,
  [SOUND_TYPE.CORRECT]: `${import.meta.env.BASE_URL}assets/sounds/correct.wav`,
  [SOUND_TYPE.INCORRECT]: `${import.meta.env.BASE_URL}assets/sounds/incorrect.wav`,
}

/**
 * 無音ループ用ファイル（iOS のサイレントスイッチ対策）
 * 再生中のメディア要素があると音声セッションが「再生」カテゴリに保たれ、
 * Web Audio の効果音が消音モードでも鳴るようになる
 */
export const SILENT_LOOP_FILE = `${import.meta.env.BASE_URL}assets/sounds/silence.wav`

/**
 * 設定情報（soundEnabled / volumeLevel）を保存する LocalStorage キー
 */
export const LOCALSTORAGE_KEY_SETTINGS = 'yqb-settings'

/**
 * 音量レベルの最大値（0-4 の5段階）
 * AudioManager.setVolume には volumeLevel / MAX_VOLUME_LEVEL（0-1）を渡す
 */
export const MAX_VOLUME_LEVEL = 4

/**
 * 音量レベルの既定値
 */
export const DEFAULT_VOLUME_LEVEL = 3
