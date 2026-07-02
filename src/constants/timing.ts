// 時間更新に関する定数

/**
 * YouTube Playerの再生時間の取得更新間隔（ミリ秒）
 * YouTubePlayerManagerのsetIntervalで使用
 */
export const TIME_UPDATE_INTERVAL_MS = 150

/**
 * シーク検出の許容誤差時間（秒）
 * タブ切り替え時のsetInterval遅延（通常0.3〜0.5秒）を許容しつつ、
 * 実際のシーク操作（UIで10秒単位のジャンプ）を確実に検出できる値。
 * 1秒に設定することで、タブ切り替え時の誤検出を防ぎつつ、意図的なシーク操作は確実に検出できる。
 */
export const SEEK_TOLERANCE_SEC = 1.0

/**
 * 時間閾値比較の許容誤差（秒）
 * YouTube IFrame APIのgetCurrentTime()の量子化誤差を吸収するため、
 * 閾値（startTime/revealTime/endTime）との比較時にこの値を加えて余裕を持たせる
 * Epsilon（イプシロン、ε）: 数学・計算機科学で微小な値を表す記号に由来
 */
export const TIME_EPSILON_SEC = 1e-3

/**
 * 再生停滞（stall）検出の閾値: 壁時計の経過時間（ミリ秒）
 * この時間以上経過しても動画時間がほとんど進まない場合、再生停滞と判定する
 */
export const STALL_WALL_MS = 1200

/**
 * 再生停滞（stall）検出の閾値: 動画時間の進行量（秒）
 * 壁時計でSTALL_WALL_MS以上経過しても、動画時間がこの値未満しか進まない場合、再生停滞と判定する
 */
export const STALL_VIDEO_DELTA_SEC = 0.05

/**
 * 再生開始直後の猶予期間（ミリ秒）
 * 再生開始直後はsetIntervalやgetCurrentTime()が不安定なため、
 * この期間中はシーク検出や再生停滞検出を行わない
 */
export const STARTUP_GRACE_MS = 1000

/**
 * ボタン押下演出時間: PUSHED → RELEASED の遷移までの時間（ミリ秒）
 */
export const BUTTON_PUSHED_DURATION_MS = 100

/**
 * ボタンチェック時の待機時間: RELEASED → STANDBY／TALKING遷移までの時間（ミリ秒）
 */
export const BUTTON_CHECK_RELEASE_MS = 1500

/**
 * 解答カウントダウンのインターバル（ミリ秒）
 * 1秒ごとに残り時間をデクリメントする
 */
export const ANSWER_COUNTDOWN_INTERVAL_MS = 1000

/**
 * YouTube Playerの巻き戻り発生の閾値（秒）
 * 5秒未満の位置で再生開始後にタブを切り替えると動画が巻き戻る仕様への対応値
 * gameManager.ts のクラス内定数から移動
 */
export const YOUTUBE_REWIND_THRESHOLD_SEC = 5.5

/**
 * YouTube IFrame API 読み込みタイムアウト（ミリ秒）
 */
export const YT_API_LOAD_TIMEOUT_MS = 10000

/**
 * YouTube IFrame API 読み込み待ちポーリング間隔（ミリ秒）
 */
export const YT_API_POLL_INTERVAL_MS = 100

/**
 * loadVideo の擬似待機時間（ミリ秒）
 * loadVideoById() 後に動画が安定して読み込まれるまでの簡易待機
 * TODO: onStateChange (CUED) ベースに置き換える際に削除する（R-5 対応予定）
 */
export const LOAD_VIDEO_SETTLE_MS = 1000

/**
 * 解答タイマーの緊急表示閾値（秒）
 * 残り時間がこの値以下になるとタイマーを赤色 + 脈動表示に切り替える
 */
export const TIMER_URGENT_THRESHOLD_SEC = 3
