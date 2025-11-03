// 時間更新に関する定数

/**
 * YouTube Playerの再生時間の取得更新間隔（ミリ秒）
 * YouTubePlayerManagerのsetIntervalで使用
 */
export const TIME_UPDATE_INTERVAL_MS = 150

/**
 * シーク検出の許容誤差時間（秒）
 * setIntervalの揺らぎやgetCurrentTime()の量子化によるシーク操作の誤検出を防ぐため、
 * 時間更新間隔の2倍以上、動画の再生時間がジャンプしたらシーク操作が発生したとする。
 * ただし、この値が小さくなりすぎると誤検出リスクが高くなるため、最小値として0.2秒の許容誤差を保証する。
 */
export const SEEK_TOLERANCE_SEC = Math.max(0.2, (TIME_UPDATE_INTERVAL_MS / 1000) * 2)

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
