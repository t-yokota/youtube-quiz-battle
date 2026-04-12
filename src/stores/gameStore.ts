// ゲーム状態管理用のPiniaストア
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { GameState, ButtonState } from '@/types'
import type { QuizData, QuestionResult } from '@/types'
import { validate } from '@/services/answerValidator'

export const useGameStore = defineStore('game', () => {
  // ============================================================================
  // State
  // ============================================================================

  // ゲーム状態
  const currentState = ref<GameState>(GameState.LOADING)
  const buttonState = ref<ButtonState>(ButtonState.STANDBY)

  // クイズデータ
  const quizData = ref<QuizData | null>(null)

  // 進行状況
  const currentQuestionIndex = ref(-1) // -1: 問題開始前, 0~: 配列インデックス
  const correctCount = ref(0)
  const incorrectCount = ref(0)

  // 解答状態
  const remainingAttempts = ref(2) // デフォルト値
  const answerTimeRemaining = ref(10) // デフォルト値（秒）
  const answerInput = ref('')
  const answerResult = ref<'correct' | 'incorrect' | null>(null)

  // 結果
  const results = ref<QuestionResult[]>([])

  // ============================================================================
  // Getters
  // ============================================================================

  // 総問題数（quizDataがない場合は0を返す）
  const totalQuestions = computed(() => {
    if (!quizData.value) {
      return 0
    }
    return quizData.value.questions.length
  })

  // UI表示用の問題番号（GameInfo.vueのcurrentQuestionNumber propsに対応）
  // 0: 問題開始前, 1~: 問題番号（1-indexed）
  const currentQuestionNumber = computed(() => {
    return currentQuestionIndex.value === -1 ? 0 : currentQuestionIndex.value + 1
  })

  // 現在の問題データ
  const currentQuestionData = computed(() => {
    if (!quizData.value || currentQuestionIndex.value < 0) return null
    return quizData.value.questions[currentQuestionIndex.value]
  })

  // ボタン表示状態
  const isButtonVisible = computed(() => {
    return currentState.value !== GameState.LOADING && currentState.value !== GameState.FINISHED
  })

  // ボタン有効状態
  const isButtonEnabled = computed(() => {
    return (
      (currentState.value === GameState.READY || currentState.value === GameState.QUESTIONING) &&
      buttonState.value === ButtonState.STANDBY
    )
  })

  // 解答入力無効状態（入力欄の制御用）
  const isInputDisabled = computed(() => {
    return currentState.value !== GameState.ANSWERING
  })

  // ガイドテキスト
  const guideText = computed(() => {
    switch (currentState.value) {
      case GameState.LOADING:
        return '読み込み中...'
      case GameState.READY:
        return 'ボタンを押してゲームを開始'
      case GameState.TALKING:
        return currentQuestionIndex.value === -1
          ? '問題の開始をお待ちください'
          : '次の問題をお待ちください'
      default:
        return ''
    }
  })

  // GamePanelのモード
  const gamePanelMode = computed<'guide' | 'answer'>(() => {
    return currentState.value === GameState.LOADING ||
      currentState.value === GameState.READY ||
      currentState.value === GameState.TALKING
      ? 'guide'
      : 'answer'
  })

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * ゲーム状態を遷移する
   */
  function transitionToState(newState: GameState) {
    console.log(`[GameStore] State transition: ${currentState.value} -> ${newState}`)
    currentState.value = newState

    // 状態に応じたボタン状態の更新
    updateButtonStateForGameState(newState)
  }

  /**
   * ゲーム状態に応じてボタン状態を更新
   */
  function updateButtonStateForGameState(state: GameState) {
    switch (state) {
      case GameState.READY:
      case GameState.QUESTIONING:
        if (buttonState.value === ButtonState.DISABLED) {
          buttonState.value = ButtonState.STANDBY
        }
        break
      case GameState.WAITING:
      case GameState.REVEALING:
      case GameState.TALKING:
        if (buttonState.value === ButtonState.STANDBY || buttonState.value === ButtonState.RELEASED) {
          buttonState.value = ButtonState.DISABLED
        }
        break
      case GameState.LOADING:
      case GameState.FINISHED:
        // ボタン非表示（ButtonStateの管理は不要）
        break
    }
  }

  /**
   * ボタン押下処理（ストア内部用）
   * UIからのボタン押下は GameManager.handleButtonPress() を経由する
   */
  function handleButtonPress() {
    if (!isButtonEnabled.value) return

    console.log(`[GameStore] Button pressed in state: ${currentState.value}`)

    // ボタン状態遷移: STANDBY -> PUSHED -> RELEASED
    buttonState.value = ButtonState.PUSHED
    setTimeout(() => {
      buttonState.value = ButtonState.RELEASED

      if (currentState.value === GameState.READY) {
        // ボタンチェック: 1500ms後にTALKING状態へ遷移
        // 動画再生は GameManager.handleButtonPress() で実行
        setTimeout(() => {
          buttonState.value = ButtonState.STANDBY
          transitionToState(GameState.TALKING)
        }, 1500)
      } else if (currentState.value === GameState.QUESTIONING) {
        // 早押し: ANSWERING状態へ遷移
        // 動画一時停止は GameManager.handleButtonPress() で実行
        transitionToState(GameState.ANSWERING)
      }
    }, 100)
  }

  /**
   * 解答送信処理
   */
  function handleAnswerSubmit(answer: string) {
    if (currentState.value !== GameState.ANSWERING) return

    const question = currentQuestionData.value
    if (!question) return

    console.log(`[GameStore] Answer submitted: ${answer}`)

    const isCorrect = validate(answer, question.answers)

    if (isCorrect) {
      // 正解
      answerResult.value = 'correct'
      correctCount.value++
      answerInput.value = ''

      // 結果を記録
      results.value.push({
        questionNumber: question.index + 1,
        isCorrect: true,
        correctAnswer: question.answers[0],
        userAnswer: answer,
      })

      console.log(`[GameStore] Correct! Score: ${correctCount.value}`)
    } else {
      // 不正解
      remainingAttempts.value--
      answerResult.value = 'incorrect'

      if (remainingAttempts.value <= 0) {
        // 残り回数なし → 不正解確定
        incorrectCount.value++
        answerInput.value = ''

        // 結果を記録
        results.value.push({
          questionNumber: question.index + 1,
          isCorrect: false,
          correctAnswer: question.answers[0],
          userAnswer: answer,
        })

        console.log(`[GameStore] Incorrect (no attempts left). Score: ${incorrectCount.value}`)
      } else {
        // まだ回数が残っている → 再入力可能
        console.log(`[GameStore] Incorrect. Remaining attempts: ${remainingAttempts.value}`)
        return // ANSWERING状態を維持
      }
    }

    // 正解または回数切れの不正解: WAITING状態へ遷移
    // （動画再開はTask 18でGameManager経由で実装）
    transitionToState(GameState.WAITING)
  }

  /**
   * 問題開始時の状態初期化
   * onStart() から呼ばれ、問題単位でリセットが必要な状態を初期化する
   */
  function initializeForQuestion() {
    remainingAttempts.value = quizData.value?.settings.maxAttempts ?? 2
    answerTimeRemaining.value = quizData.value?.settings.answerTimeLimit ?? 10
    answerInput.value = ''
    answerResult.value = null
  }

  /**
   * 解答入力更新処理
   */
  function updateAnswerInput(value: string) {
    answerInput.value = value
  }

  /**
   * クイズデータを設定
   */
  function setQuizData(data: QuizData) {
    quizData.value = data
    console.log(`[GameStore] Quiz data loaded: ${data.questions.length} questions`)

    // 設定値を適用
    remainingAttempts.value = data.settings.maxAttempts
    answerTimeRemaining.value = data.settings.answerTimeLimit
  }

  /**
   * ゲームをリセット
   */
  function resetGame() {
    currentState.value = GameState.LOADING
    buttonState.value = ButtonState.STANDBY
    currentQuestionIndex.value = -1
    correctCount.value = 0
    incorrectCount.value = 0
    answerInput.value = ''
    answerResult.value = null
    results.value = []
  }

  return {
    // State
    currentState,
    buttonState,
    quizData,
    currentQuestionIndex,
    correctCount,
    incorrectCount,
    remainingAttempts,
    answerTimeRemaining,
    answerInput,
    answerResult,
    results,
    // Getters
    totalQuestions,
    currentQuestionNumber,
    currentQuestionData,
    isButtonVisible,
    isButtonEnabled,
    isInputDisabled,
    guideText,
    gamePanelMode,
    // Actions
    transitionToState,
    handleButtonPress,
    handleAnswerSubmit,
    updateAnswerInput,
    initializeForQuestion,
    setQuizData,
    resetGame,
  }
})
