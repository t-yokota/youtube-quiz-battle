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
 * 再生停滞（stall）検出の閾値: 壁時計の経過時間（ミリ秒）
 * この時間以上経過しても動画時間がほとんど進まない場合、再生停滞と判定する
 */
export const STALL_WALL_MS = 1200

/**
 * 再生停滞（stall）検出の閾値: 動画時間の進行量（秒）
 * 壁時計でSTALL_WALL_MS以上経過しても、動画時間がこの値未満しか進まない場合、再生停滞と判定する
 */
export const STALL_VIDEO_DELTA_SEC = 0.05
