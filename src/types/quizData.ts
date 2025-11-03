// クイズデータの型定義

// クイズ問題の型定義
export interface QuizQuestion {
  index: number // 配列インデックス（0-indexed）
  startTime: number // 問読み区間の開始時間（秒）
  revealTime: number // 正解発表区間の開始時間（秒）
  endTime: number // 正解発表区間の終了時間（秒）
  answers: string[] // 正解パターンのリスト
  othersAnsweringPeriods?: OthersAnsweringPeriod[] // 動画内プレイヤーの解答区間
}

// 動画内プレイヤーの解答区間
export interface OthersAnsweringPeriod {
  startTime: number // 解答区間の開始時間（秒）
  endTime: number // 解答区間の終了時間（秒）
}

// クイズ設定の型定義
export interface QuizSettings {
  maxAttempts: number // 最大解答回数
  answerTimeLimit: number // 解答制限時間（秒）
  disableSeekbar: boolean // シークバーの操作を無効にする設定
  jumpToRevealPeriod: boolean // 解答後に正解発表区間へジャンプするか
  hideVideoPlayerDuringAnswer: boolean // 解答中に動画プレイヤーを隠す設定
}

// クイズデータ全体の型定義
export interface QuizData {
  videoId: string // YouTubeの動画ID
  questions: QuizQuestion[] // 問題のリスト
  settings: QuizSettings // クイズ設定
}
