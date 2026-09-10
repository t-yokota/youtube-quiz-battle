import { computed, ref, watch, type Ref } from 'vue'
import type { QuizData, YouTubePlayerManager } from '@/types'
import { GameState } from '@/types'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { createAnalyticsService, type ChangeableSettingName } from '@/services/analyticsService'
import { validate } from '@/services/answerValidator'
import { createUuid } from '@/utils/uuid'
import { logger } from '@/utils/logger'

/** コンポーネントのスコープ内でゲームを監視し、Analyticsの送信状態を所有する。 */
export function useQuizAnalytics(
  currentQuizId: string,
  quizData: Readonly<Ref<QuizData | null>>,
  playerManagerRef: Readonly<Ref<YouTubePlayerManager | null>>,
) {
  const gameStore = useGameStore()
  const settingsStore = useSettingsStore()
  const analyticsService = createAnalyticsService()
  const quizSessionId = ref('')
  const videoTitle = ref('')

  const seekAllowed = computed(
    () =>
      !(settingsStore.disableSeekbarOverride ?? quizData.value?.settings.disableSeekbar ?? true),
  )
  function quizIdentity() {
    return {
      quizSessionId: quizSessionId.value,
      quizId: currentQuizId,
      videoId: quizData.value?.videoId ?? '',
    }
  }
  function sessionContext() {
    return { ...quizIdentity(), videoTitle: videoTitle.value || undefined }
  }

  // セッション進行中（started 送信後〜FINISHED 前）のみ設定変更イベントを送る
  const isSessionActive = computed(
    () =>
      quizSessionId.value !== '' &&
      gameStore.currentState !== GameState.READY &&
      gameStore.currentState !== GameState.LOADING &&
      gameStore.currentState !== GameState.FINISHED,
  )

  // クイズ中に作用する設定の変更を記録する（READY での変更は次セッションの
  // quiz_session_started スナップショットに反映されるため送らない）
  function logSettingChange(settingName: ChangeableSettingName, value: boolean | number) {
    if (!isSessionActive.value) return
    analyticsService.logSettingChanged({
      ...quizIdentity(),
      settingName,
      settingValue: value,
      questionIndex: gameStore.currentQuestionIndex,
    })
  }

  watch(seekAllowed, (allowed, previous) => {
    if (allowed === previous) return
    logSettingChange('seek_allowed', allowed)
  })

  watch(
    () => gameStore.isButtonCheckEnabled,
    (enabled, prevEnabled) => {
      if (enabled === prevEnabled) return
      logSettingChange('button_check_enabled', enabled)
    },
  )

  // デバッグ上書きで変わる実効設定の変更も記録する（debug データ中のみ変化し得る）
  watch(
    () => gameStore.effectiveSettings?.jumpToRevealPeriod,
    (value, prev) => {
      if (value === undefined || prev === undefined || value === prev) return
      logSettingChange('jump_to_reveal_period', value)
    },
  )

  watch(
    () => gameStore.effectiveSettings?.hideVideoPlayerDuringAnswer,
    (value, prev) => {
      if (value === undefined || prev === undefined || value === prev) return
      logSettingChange('hide_video_player_during_answer', value)
    },
  )

  watch(
    () => gameStore.effectiveSettings?.answerTimeLimit,
    (value, prev) => {
      if (value === undefined || prev === undefined || value === prev) return
      logSettingChange('answer_time_limit', value)
    },
  )

  watch(
    () => gameStore.effectiveSettings?.maxAttempts,
    (value, prev) => {
      if (value === undefined || prev === undefined || value === prev) return
      logSettingChange('max_attempts', value)
    },
  )
  // results への送信済み件数（gameStore.results は push 追記のため length を監視する）
  const lastSentResultCount = ref(0)

  watch(
    quizData,
    (data) => {
      if (data) analyticsService.setDebugMode(data.settings.debug)
    },
    { immediate: true, flush: 'sync' },
  )

  // --- Analytics フック ---

  // READY -> TALKING でセッション開始（リプレイは別セッションとして新規発行する）
  watch(
    () => gameStore.currentState,
    (next, prev) => {
      if (prev === GameState.READY && next === GameState.TALKING) {
        quizSessionId.value = createUuid()
        lastSentResultCount.value = 0
        videoTitle.value = playerManagerRef.value?.getVideoTitle() ?? ''

        // ゲーム開始時点の実効設定（ユーザー上書き・デバッグ上書き適用後）をスナップショット
        const effective = gameStore.effectiveSettings
        analyticsService.logQuizSessionStarted({
          ...sessionContext(),
          totalQuestions: gameStore.totalQuestions,
          buttonCheckEnabled: gameStore.isButtonCheckEnabled,
          seekAllowed: seekAllowed.value,
          jumpToRevealPeriod: effective?.jumpToRevealPeriod ?? false,
          hideVideoPlayerDuringAnswer: effective?.hideVideoPlayerDuringAnswer ?? false,
          answerTimeLimit: effective?.answerTimeLimit ?? 0,
          maxAttempts: effective?.maxAttempts ?? 0,
        })
      }

      if (next === GameState.FINISHED) {
        const results = gameStore.results
        const skippedCount = results.filter((r) => r.skipped).length
        const unansweredCount = results.filter(
          (r) => !r.skipped && !r.isCorrect && r.userAnswers.length === 0,
        ).length
        const totalAttempts = results.reduce((sum, r) => sum + r.userAnswers.length, 0)

        analyticsService.logQuizSessionCompleted({
          ...sessionContext(),
          totalQuestions: gameStore.totalQuestions,
          correctCount: gameStore.correctCount,
          incorrectCount: gameStore.incorrectCount,
          skippedCount,
          unansweredCount,
          totalAttempts,
        })
      }
    },
  )

  // results は push 追記のため length を監視し、増分の各 QuestionResult を送信する
  watch(
    () => gameStore.results.length,
    (length) => {
      const results = gameStore.results

      for (let i = lastSentResultCount.value; i < length; i++) {
        const result = results[i]
        const questionIndex = result.questionNumber - 1
        const question = quizData.value?.questions[questionIndex]
        const questionText = question?.questionText

        result.userAnswers.forEach((answer, idx) => {
          const attemptIndex = idx + 1
          const timeUntilPress = result.timesUntilPress[idx]

          // 押下と解答は原則1:1対応するが、保険として欠損時はその試行を送らず警告する
          // （0埋めより分析データの意味が壊れにくい）
          if (timeUntilPress === undefined) {
            logger.warn(
              `[useQuizAnalytics] timesUntilPress missing for question ${result.questionNumber} attempt ${attemptIndex}`,
            )
            return
          }

          const submissionType = result.submissionTypes[idx] ?? 'manual'
          const isCorrect = question ? validate(answer, question.answers) : false

          analyticsService.logAnswerSubmitted({
            ...sessionContext(),
            questionIndex,
            attemptIndex,
            answer,
            isCorrect,
            isFinalAttempt: attemptIndex === result.userAnswers.length,
            submissionType,
            timeUntilPressSec: timeUntilPress,
            questionText,
          })
        })

        const resultLabel: 'correct' | 'incorrect' | 'skipped' | 'unanswered' = result.skipped
          ? 'skipped'
          : result.isCorrect
            ? 'correct'
            : result.userAnswers.length === 0
              ? 'unanswered'
              : 'incorrect'

        analyticsService.logQuestionAnswered({
          ...sessionContext(),
          questionIndex,
          result: resultLabel,
          attemptsUsed: result.userAnswers.length,
          answers: result.userAnswers.join('|'),
          timesUntilPressSec: result.timesUntilPress.map((t) => t.toFixed(1)).join('|'),
          firstTimeUntilPressSec: result.timesUntilPress[0],
          questionText,
        })
      }

      lastSentResultCount.value = length
    },
  )

  return { initialize: () => analyticsService.init() }
}
