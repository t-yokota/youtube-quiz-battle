// Analytics サービス用の定数

// GA4 のパラメータ値の文字数上限（超過分は切り詰める）
export const ANALYTICS_PARAM_MAX_LENGTH = 100

/**
 * GA4 の測定 ID（gtag.js 用）
 * 空文字のときは Analytics を初期化しない（no-op）。
 * ビルド時のVITE_GA_MEASUREMENT_IDで上書き可能。未指定なら従来の本番ID。
 * Web の測定 ID は公開前提の識別子であり秘密ではない
 */
export const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID ?? 'G-JZTD11WD9E'
