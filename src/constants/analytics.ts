// Analytics サービス用の定数

// initializing 中に log* が呼ばれた際にキューへ積める上限件数（超過分は破棄）
export const ANALYTICS_QUEUE_MAX_SIZE = 50

// GA4 のパラメータ値の文字数上限（超過分は切り詰める）
export const ANALYTICS_PARAM_MAX_LENGTH = 100
