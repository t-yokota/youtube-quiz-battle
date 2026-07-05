// クイズデータ管理サービス
import type { QuizData, QuizQuestion, QuizSettings } from '@/types'
import { withRetry } from '@/services/errorHandler'

// データファイルの型定義（実際のJSONファイルの構造）
interface RawQuizData {
  videoId: string
  quizTitle?: string
  settings: {
    maxAttempts: number
    answerTimeLimit: number
    disableSeekbar?: boolean
    jumpToRevealPeriod?: boolean
    hideVideoPlayerDuringAnswer?: boolean
    buttonCheckEnabled?: boolean
    debug?: boolean
  }
  questions: Array<{
    questionNumber?: number // 問題番号（1-indexed）
    questionText?: string
    answers: string[]
    startTime: number
    revealTime: number
    endTime: number
    othersAnsweringPeriods?: Array<{
      startTime: number
      endTime: number
    }>
  }>
}

/**
 * quizId として許可する形式（slug）。任意文字列で fetch URL を組み立てない
 */
const QUIZ_ID_PATTERN = /^[a-z0-9-]{1,64}$/

/**
 * URL から quizId を抽出（?quiz={quizId}。未指定時は 'sample'）
 */
export function extractQuizIdFromUrl(): string {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('quiz') ?? 'sample'
}

/**
 * クイズデータを読み込み
 */
export async function loadQuizData(quizId: string): Promise<QuizData> {
  try {
    // slug 形式以外は fetch せずに not found 扱い
    if (!QUIZ_ID_PATTERN.test(quizId)) {
      throw new Error('QUIZ_DATA_NOT_FOUND')
    }

    // BASE_URL 前置: GitHub Pages のサブパス配信に対応（末尾スラッシュ付き）
    const dataPath = `${import.meta.env.BASE_URL}data/${quizId}/data.json`

    const response = await withRetry(async () => {
      const res = await fetch(dataPath)
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('QUIZ_DATA_NOT_FOUND')
        }
        throw new Error('QUIZ_DATA_LOAD_FAILED')
      }
      return res
    })

    // 開発サーバ等の SPA フォールバックは不在パスにも 200 で HTML を返すため、
    // JSON として読めない応答はデータ不在として扱う
    let rawData: RawQuizData
    try {
      rawData = (await response.json()) as RawQuizData
    } catch {
      throw new Error('QUIZ_DATA_NOT_FOUND')
    }

    // データ検証
    validateQuizData(rawData)

    // 型定義への変換
    return convertToQuizData(rawData)
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('QUIZ_DATA_LOAD_FAILED')
  }
}

/**
 * クイズデータを検証
 */
function validateQuizData(data: RawQuizData): void {
  // 必須フィールドのチェック
  if (!data.videoId) {
    throw new Error('QUIZ_DATA_INVALID: Missing videoId')
  }

  if (!data.questions || !Array.isArray(data.questions)) {
    throw new Error('QUIZ_DATA_INVALID: Missing or invalid questions array')
  }

  if (data.questions.length === 0) {
    throw new Error('QUIZ_DATA_INVALID: Questions array is empty')
  }

  // 動画ID整合性チェック（sampleの場合はスキップ）

  // クイズ設定のチェック
  if (!data.settings) {
    throw new Error('QUIZ_DATA_INVALID: Missing settings')
  }

  if (typeof data.settings.answerTimeLimit !== 'number' || data.settings.answerTimeLimit <= 0) {
    throw new Error('QUIZ_DATA_INVALID: Invalid answerTimeLimit')
  }

  if (typeof data.settings.maxAttempts !== 'number' || data.settings.maxAttempts <= 0) {
    throw new Error('QUIZ_DATA_INVALID: Invalid maxAttempts')
  }

  if (
    data.settings.buttonCheckEnabled !== undefined &&
    typeof data.settings.buttonCheckEnabled !== 'boolean'
  ) {
    throw new Error('QUIZ_DATA_INVALID: Invalid buttonCheckEnabled')
  }

  if (data.settings.debug !== undefined && typeof data.settings.debug !== 'boolean') {
    throw new Error('QUIZ_DATA_INVALID: Invalid debug')
  }

  // 各問題のチェック
  data.questions.forEach((q, index) => {
    // 必須フィールド
    if (!q.answers || !Array.isArray(q.answers) || q.answers.length === 0) {
      throw new Error(`QUIZ_DATA_INVALID: Question ${index + 1} has invalid answers`)
    }

    if (q.answers.some((a) => typeof a !== 'string' || a.trim() === '')) {
      throw new Error(`QUIZ_DATA_INVALID: Question ${index + 1} has empty answer`)
    }

    // questionTextの妥当性チェック（任意項目）
    if (q.questionText !== undefined && typeof q.questionText !== 'string') {
      throw new Error(`QUIZ_DATA_INVALID: Question ${index + 1} has invalid questionText`)
    }

    // 時間データの妥当性チェック
    if (typeof q.startTime !== 'number' || q.startTime < 0) {
      throw new Error(`QUIZ_DATA_INVALID: Question ${index + 1} has invalid startTime`)
    }

    if (typeof q.revealTime !== 'number' || q.revealTime < 0) {
      throw new Error(`QUIZ_DATA_INVALID: Question ${index + 1} has invalid revealTime`)
    }

    if (typeof q.endTime !== 'number' || q.endTime < 0) {
      throw new Error(`QUIZ_DATA_INVALID: Question ${index + 1} has invalid endTime`)
    }

    if (!(q.startTime < q.revealTime && q.revealTime < q.endTime)) {
      throw new Error(
        `QUIZ_DATA_INVALID: Question ${index + 1} has invalid time sequence (startTime < revealTime < endTime required)`,
      )
    }

    // OthersAnsweringPeriodsの検証
    if (q.othersAnsweringPeriods) {
      q.othersAnsweringPeriods.forEach((period, pIndex) => {
        if (typeof period.startTime !== 'number' || typeof period.endTime !== 'number') {
          throw new Error(
            `QUIZ_DATA_INVALID: Question ${index + 1} othersAnsweringPeriod ${pIndex + 1} has invalid time`,
          )
        }

        if (period.startTime >= period.endTime) {
          throw new Error(
            `QUIZ_DATA_INVALID: Question ${index + 1} othersAnsweringPeriod ${pIndex + 1} has startTime >= endTime`,
          )
        }

        // QUIZ区間内にあるかチェック
        if (period.startTime < q.startTime || period.endTime > q.revealTime) {
          throw new Error(
            `QUIZ_DATA_INVALID: Question ${index + 1} othersAnsweringPeriod ${pIndex + 1} is outside question period`,
          )
        }
      })

      // 複数期間の昇順・非重複チェック（design.md 仕様: periods[i].end <= periods[i+1].start）
      for (let i = 0; i < q.othersAnsweringPeriods.length - 1; i++) {
        const current = q.othersAnsweringPeriods[i]
        const next = q.othersAnsweringPeriods[i + 1]
        if (current.endTime > next.startTime) {
          throw new Error(
            `QUIZ_DATA_INVALID: Question ${index + 1} has overlapping othersAnsweringPeriods (${i + 1} and ${i + 2})`,
          )
        }
      }
    }
  })

  // QUIZ区間の被りチェック
  for (let i = 0; i < data.questions.length - 1; i++) {
    const current = data.questions[i]
    const next = data.questions[i + 1]

    if (current.endTime > next.startTime) {
      throw new Error(
        `QUIZ_DATA_INVALID: Question ${i + 1} and ${i + 2} have overlapping time periods`,
      )
    }
  }
}

/**
 * RawQuizDataをQuizDataに変換
 */
function convertToQuizData(rawData: RawQuizData): QuizData {
  const settings: QuizSettings = {
    maxAttempts: rawData.settings.maxAttempts,
    answerTimeLimit: rawData.settings.answerTimeLimit,
    disableSeekbar: rawData.settings.disableSeekbar ?? true,
    jumpToRevealPeriod: rawData.settings.jumpToRevealPeriod ?? false,
    hideVideoPlayerDuringAnswer: rawData.settings.hideVideoPlayerDuringAnswer ?? false,
    buttonCheckEnabled: rawData.settings.buttonCheckEnabled ?? false,
    debug: rawData.settings.debug ?? false,
  }

  const questions: QuizQuestion[] = rawData.questions.map((q, idx) => {
    // JSONのquestionNumber（1-indexed）を検証
    if (q.questionNumber !== undefined && q.questionNumber !== idx + 1) {
      throw new Error(
        `QUIZ_DATA_INVALID: Question ${idx + 1} has questionNumber mismatch (expected: ${idx + 1}, got: ${q.questionNumber})`,
      )
    }

    return {
      index: idx, // 配列インデックス（0-indexed）を割り当て
      startTime: q.startTime,
      revealTime: q.revealTime,
      endTime: q.endTime,
      answers: q.answers,
      othersAnsweringPeriods: q.othersAnsweringPeriods,
      questionText: q.questionText,
    }
  })

  return {
    videoId: rawData.videoId,
    settings,
    questions,
  }
}
