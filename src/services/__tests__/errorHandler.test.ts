import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ERROR_MESSAGES } from '@/constants/errorMessages'
import { RETRY_BACKOFF_MS } from '@/constants/timing'
import { classifyError, getErrorInfo, getErrorMessage, isRecoverable, withRetry } from '../errorHandler'
import type { ErrorCode } from '../errorHandler'

describe('classifyError', () => {
  it.each(Object.keys(ERROR_MESSAGES) as ErrorCode[])(
    '正常系: "%s: <詳細>" 形式のメッセージを %s に分類する',
    (code) => {
      const error = new Error(`${code}: some detail`)
      expect(classifyError(error)).toBe(code)
    },
  )

  it('正常系: サフィックスなしのメッセージでも前方一致で分類する', () => {
    const error = new Error('QUIZ_DATA_INVALID')
    expect(classifyError(error)).toBe('QUIZ_DATA_INVALID')
  })

  it('正常系: "QUIZ_DATA_INVALID: Missing videoId" を QUIZ_DATA_INVALID に分類する', () => {
    const error = new Error('QUIZ_DATA_INVALID: Missing videoId')
    expect(classifyError(error)).toBe('QUIZ_DATA_INVALID')
  })

  it('正常系: TypeError は NETWORK_ERROR に分類する', () => {
    const error = new TypeError('Failed to fetch')
    expect(classifyError(error)).toBe('NETWORK_ERROR')
  })

  it('異常系: 未知の Error メッセージは GENERIC_ERROR に分類する', () => {
    const error = new Error('SOMETHING_UNKNOWN')
    expect(classifyError(error)).toBe('GENERIC_ERROR')
  })

  it('異常系: Error 以外の値（文字列）は GENERIC_ERROR に分類する', () => {
    expect(classifyError('plain string error')).toBe('GENERIC_ERROR')
  })

  it('異常系: Error 以外の値（undefined）は GENERIC_ERROR に分類する', () => {
    expect(classifyError(undefined)).toBe('GENERIC_ERROR')
  })
})

describe('getErrorMessage', () => {
  it('正常系: エラーコードに対応する日本語メッセージを返す', () => {
    const error = new Error('QUIZ_DATA_NOT_FOUND')
    expect(getErrorMessage(error)).toBe(ERROR_MESSAGES.QUIZ_DATA_NOT_FOUND)
  })

  it('正常系: TypeError は NETWORK_ERROR のメッセージを返す', () => {
    const error = new TypeError('network down')
    expect(getErrorMessage(error)).toBe(ERROR_MESSAGES.NETWORK_ERROR)
  })

  it('異常系: 未知のエラーは GENERIC_ERROR のメッセージを返す', () => {
    expect(getErrorMessage('unknown')).toBe(ERROR_MESSAGES.GENERIC_ERROR)
  })
})

describe('isRecoverable', () => {
  it('正常系: NETWORK_ERROR は true', () => {
    expect(isRecoverable('NETWORK_ERROR')).toBe(true)
  })

  it('正常系: QUIZ_DATA_LOAD_FAILED は true', () => {
    expect(isRecoverable('QUIZ_DATA_LOAD_FAILED')).toBe(true)
  })

  it.each(
    (Object.keys(ERROR_MESSAGES) as ErrorCode[]).filter(
      (code) => code !== 'NETWORK_ERROR' && code !== 'QUIZ_DATA_LOAD_FAILED',
    ),
  )('異常系: %s は false', (code) => {
    expect(isRecoverable(code)).toBe(false)
  })
})

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('正常系: 初回で成功した場合は即座に結果を返す', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('正常系: 復旧可能エラーの場合は最大3回まで指数バックオフでリトライする', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
      .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
      .mockResolvedValueOnce('recovered')

    const promise = withRetry(fn)

    // 1回目失敗直後
    expect(fn).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(RETRY_BACKOFF_MS[0])
    expect(fn).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(RETRY_BACKOFF_MS[1])
    expect(fn).toHaveBeenCalledTimes(3)

    await expect(promise).resolves.toBe('recovered')
  })

  it('異常系: 復旧可能エラーが最大試行回数まで続いた場合は最後のエラーを throw する', async () => {
    const errors = [
      new Error('NETWORK_ERROR'),
      new Error('NETWORK_ERROR'),
      new Error('QUIZ_DATA_LOAD_FAILED'),
    ]
    const fn = vi
      .fn()
      .mockRejectedValueOnce(errors[0])
      .mockRejectedValueOnce(errors[1])
      .mockRejectedValueOnce(errors[2])

    const promise = withRetry(fn)
    const assertion = expect(promise).rejects.toBe(errors[2])

    await vi.advanceTimersByTimeAsync(RETRY_BACKOFF_MS[0])
    await vi.advanceTimersByTimeAsync(RETRY_BACKOFF_MS[1])

    await assertion
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('異常系: 復旧不可能なエラーは即座に throw し、リトライしない', async () => {
    const error = new Error('QUIZ_DATA_INVALID: Missing videoId')
    const fn = vi.fn().mockRejectedValue(error)

    await expect(withRetry(fn)).rejects.toBe(error)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('getErrorInfo', () => {
  it('QUIZ_DATA_NOT_FOUND は専用の見出しを返す', () => {
    const info = getErrorInfo(new Error('QUIZ_DATA_NOT_FOUND'))
    expect(info.title).toBe('クイズが見つかりません')
    expect(info.message).toContain('URLの指定')
  })

  it('見出し未定義のコードは既定の見出しを返す', () => {
    const info = getErrorInfo(new Error('QUIZ_DATA_INVALID: Missing settings'))
    expect(info.title).toBe('エラーが発生しました')
  })
})
