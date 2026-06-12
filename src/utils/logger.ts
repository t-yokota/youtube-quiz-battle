/// <reference types="vite/client" />
/* DEV ビルドでのみ出力するロガー。本番ビルドでは no-op */
const enabled = import.meta.env.DEV
export const logger = {
  log: (...args: unknown[]) => {
    if (enabled) console.log(...args)
  },
  warn: (...args: unknown[]) => {
    if (enabled) console.warn(...args)
  },
  error: (...args: unknown[]) => {
    console.error(...args) // error は本番でも出す
  },
}
