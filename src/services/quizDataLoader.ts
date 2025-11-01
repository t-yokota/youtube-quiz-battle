// クイズデータ管理サービス
import type { QuizData, QuizQuestion, QuizSettings } from '@/types'

// データファイルの型定義（実際のJSONファイルの構造）
interface RawQuizData {
  youtubeVideoId: string
  quizTitle?: string
  quizSettings: {
    maxAttempts: number
    answerTimeLimit: number
    disableSeekbar?: boolean
    jumpToRevealPeriod?: boolean
    hideVideoPlayerDuringAnswer?: boolean
  }
  questions: Array<{
    id?: number // 問題番号（1-indexed）
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
 * URLからvideoIdを抽出
 */
export function extractVideoIdFromUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search)
  // ?v={videoId} または ?video={videoId}
  return urlParams.get('v') || urlParams.get('video')
}

/**
 * クイズデータを読み込み
 */
export async function loadQuizData(videoId: string): Promise<QuizData> {
  try {
    // videoId が "sample" の場合はサンプルデータを読み込む
    const dataPath = videoId === 'sample' ? '/data/sample/data.json' : `/data/${videoId}/data.json`

    const response = await fetch(dataPath)

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('QUIZ_DATA_NOT_FOUND')
      }
      throw new Error('QUIZ_DATA_LOAD_FAILED')
    }

    const rawData: RawQuizData = await response.json()

    // データ検証
    validateQuizData(rawData, videoId)

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
function validateQuizData(data: RawQuizData, expectedVideoId: string): void {
  // 必須フィールドのチェック
  if (!data.youtubeVideoId) {
    throw new Error('QUIZ_DATA_INVALID: Missing youtubeVideoId')
  }

  if (!data.questions || !Array.isArray(data.questions)) {
    throw new Error('QUIZ_DATA_INVALID: Missing or invalid questions array')
  }

  if (data.questions.length === 0) {
    throw new Error('QUIZ_DATA_INVALID: Questions array is empty')
  }

  // 動画ID整合性チェック（sampleの場合はスキップ）
  if (expectedVideoId !== 'sample' && data.youtubeVideoId !== expectedVideoId) {
    throw new Error(
      `QUIZ_DATA_INVALID: Video ID mismatch (expected: ${expectedVideoId}, got: ${data.youtubeVideoId})`,
    )
  }

  // クイズ設定のチェック
  if (!data.quizSettings) {
    throw new Error('QUIZ_DATA_INVALID: Missing quizSettings')
  }

  if (
    typeof data.quizSettings.answerTimeLimit !== 'number' ||
    data.quizSettings.answerTimeLimit <= 0
  ) {
    throw new Error('QUIZ_DATA_INVALID: Invalid answerTimeLimit')
  }

  if (typeof data.quizSettings.maxAttempts !== 'number' || data.quizSettings.maxAttempts <= 0) {
    throw new Error('QUIZ_DATA_INVALID: Invalid maxAttempts')
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
    maxAttempts: rawData.quizSettings.maxAttempts,
    answerTimeLimit: rawData.quizSettings.answerTimeLimit,
    disableSeekbar: rawData.quizSettings.disableSeekbar ?? true,
    jumpToRevealPeriod: rawData.quizSettings.jumpToRevealPeriod ?? false,
    hideVideoPlayerDuringAnswer: rawData.quizSettings.hideVideoPlayerDuringAnswer ?? false,
  }

  const questions: QuizQuestion[] = rawData.questions.map((q) => ({
    startTime: q.startTime,
    revealTime: q.revealTime,
    endTime: q.endTime,
    answers: q.answers,
    othersAnsweringPeriods: q.othersAnsweringPeriods,
  }))

  return {
    videoId: rawData.youtubeVideoId,
    settings,
    questions,
  }
}
