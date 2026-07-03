// エラー分類・メッセージ変換・リトライ制御サービス
import { ERROR_MESSAGES } from '@/constants/errorMessages'
import { RETRY_BACKOFF_MS } from '@/constants/timing'

export type ErrorCode = keyof typeof ERROR_MESSAGES

const ERROR_CODES = Object.keys(ERROR_MESSAGES) as ErrorCode[]

function isErrorCode(value: string): value is ErrorCode {
  return (ERROR_CODES as string[]).includes(value)
}

/**
 * エラーを ErrorCode に分類する
 * 分類規則（順に評価）:
 *  1. Error かつ message の ':' 前部分が ERROR_MESSAGES のキーに一致 → そのコード
 *  2. TypeError（fetch のネットワーク断は TypeError を投げる）→ 'NETWORK_ERROR'
 *  3. それ以外 → 'GENERIC_ERROR'
 */
export function classifyError(error: unknown): ErrorCode {
  if (error instanceof Error) {
    const prefix = error.message.split(':')[0].trim()
    if (isErrorCode(prefix)) {
      return prefix
    }
  }

  if (error instanceof TypeError) {
    return 'NETWORK_ERROR'
  }

  return 'GENERIC_ERROR'
}

/**
 * エラーからユーザー向けメッセージを取得する
 */
export function getErrorMessage(error: unknown): string {
  return ERROR_MESSAGES[classifyError(error)]
}

/**
 * 自動リトライで復旧可能なエラーコードかどうかを判定する
 * 裁定 E2: NETWORK_ERROR / QUIZ_DATA_LOAD_FAILED のみリトライ対象
 */
export function isRecoverable(code: ErrorCode): boolean {
  return code === 'NETWORK_ERROR' || code === 'QUIZ_DATA_LOAD_FAILED'
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 復旧可能なエラーのみ指数バックオフでリトライする
 * 復旧不可能なエラーは即座に rethrow する
 */
const DEFAULT_MAX_ATTEMPTS = 3

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      const isLastAttempt = attempt === maxAttempts - 1
      if (isLastAttempt || !isRecoverable(classifyError(error))) {
        throw error
      }

      await wait(RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1])
    }
  }

  throw lastError
}
