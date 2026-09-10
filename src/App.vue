<script setup lang="ts">
// YouTube Quiz Battle - メインアプリケーション
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import AppHeader from './components/common/AppHeader.vue'
import VideoPlayer from './components/common/VideoPlayer.vue'
import PwaUpdatePrompt from './components/common/PwaUpdatePrompt.vue'
import GameInfo from './components/game/GameInfo.vue'
import GamePanel from './components/game/GamePanel.vue'
import QuizButton from './components/game/QuizButton.vue'
import FinalScore from './components/result/FinalScore.vue'
import ResultTable from './components/result/ResultTable.vue'
import ResultActions from './components/result/ResultActions.vue'
import SettingsModal from './components/dialogs/SettingsModal.vue'
import LoadingDialog from './components/dialogs/LoadingDialog.vue'
import OrientationDialog from './components/dialogs/OrientationDialog.vue'
import ErrorDialog from './components/dialogs/ErrorDialog.vue'
import ThemeSwitcher from './components/theme/ThemeSwitcher.vue'
import { useTheme } from './composables/useTheme'
import { useGameStore } from './stores/gameStore'
import { useSettingsStore } from './stores/settingsStore'
import { useQuizSession } from './composables/useQuizSession'
import { useQuizAnalytics } from './composables/useQuizAnalytics'
import { useOrientationGuard } from './composables/useOrientationGuard'
import { GameState } from './types'
import { shouldHandleSpaceKey } from './utils/keyboardHandler'

type StartGateConceptStyle = 'accent-only' | 'white-fill'

// 白下地付きと比較する場合は 'white-fill' へ切り替える
// const START_GATE_CONCEPT_STYLE: StartGateConceptStyle = 'accent-only'
const START_GATE_CONCEPT_STYLE: StartGateConceptStyle = 'white-fill'

let disposed = false
let scrollFrame: number | null = null
const gameStore = useGameStore()
const settingsStore = useSettingsStore()
const session = useQuizSession()
const { quizData, initError, handlePlayerReady, handlePlayerError } = session
const { initialize: initializeAnalytics } = useQuizAnalytics(
  session.currentQuizId,
  quizData,
  session.playerManagerRef,
)

// モーダル・ダイアログの表示状態
const isSettingsOpen = ref(false)

// UI テーマ（起動時に保存済みテーマを適用）
useTheme()
const isThemeSwitcherOpen = ref(false)

const handleOpenThemeSwitcher = () => {
  // 設定モーダルから開くため、先に閉じてから表示する
  isSettingsOpen.value = false
  isThemeSwitcherOpen.value = true
}

// 画面向き検出（横画面時は External Pause で一時停止し、ダイアログを表示）
const { isLandscape: isOrientationOpen, stop: stopOrientationGuard } = useOrientationGuard(
  session.pauseForOrientation,
  session.resumeForOrientation,
)

// --- イベントハンドラ ---

// QuizButton 押下 → GameManager に委譲
function isGameInputBlocked(): boolean {
  return (
    !isGateDismissed.value ||
    isSettingsOpen.value ||
    isThemeSwitcherOpen.value ||
    isOrientationOpen.value ||
    initError.value !== null
  )
}

function handleButtonPress() {
  if (isGameInputBlocked()) return
  // iOS ではキーボードがユーザー操作内の同期 focus() でしか開かないため、
  // ANSWERING 遷移（100ms 後）を待たずタップ内で入力欄を有効化して focus する
  // （disabled の直書きは直後の ANSWERING 遷移で Vue の束縛が正式に引き継ぐ）
  if (isTouchDevice && gameStore.currentState === GameState.QUESTIONING) {
    const input = document.querySelector<HTMLInputElement>('.answer-input')
    if (input) {
      input.disabled = false
      input.focus({ preventScroll: true })
    }
  }
  session.pressButton()
}

// スペースキー早押し（グローバルキーボードハンドラ）
function handleKeyDown(e: KeyboardEvent) {
  if (isGameInputBlocked() || !shouldHandleSpaceKey(e)) return
  e.preventDefault() // スペースキーによるページスクロールを抑止
  handleButtonPress()
}

// 開始ゲート（音声許諾 + メディア priming）。READY 到達後に表示し、タップで解除する
const isGateDismissed = ref(false)

function handleGateTap() {
  // READY（プレイヤー準備完了）までは解除しない
  if (!session.primeMedia()) return
  isGateDismissed.value = true

  // Analytics 初期化（ゲート解除直後。fire-and-forget）
  void initializeAnalytics()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

// hideVideoPlayerDuringAnswer=true の場合、ANSWERING 中は動画を visibility で隠す（Task 20-4）
const shouldHidePlayer = computed(
  () =>
    (gameStore.effectiveSettings?.hideVideoPlayerDuringAnswer ?? false) &&
    gameStore.currentState === GameState.ANSWERING,
)

// タッチデバイス判定（初回評価のみ。useOrientationGuard と同じ基準）
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches

// タッチデバイスの ANSWERING 中は動画とボタン領域を高さごと畳み、
// 解答エリアを画面上部に出してソフトキーボードと共存させる（Task 22-1）。
// hideVideoPlayerDuringAnswer の実効値に従う（OFF ならキーボードが解答エリアに
// 重なり得るが、短答想定のため致命的ではない — 2026-07-05 裁定）
const shouldCollapseForKeyboard = computed(
  () =>
    isTouchDevice &&
    gameStore.currentState === GameState.ANSWERING &&
    (gameStore.effectiveSettings?.hideVideoPlayerDuringAnswer ?? false),
)

// キーボード表示に伴う iOS の自動スクロールを打ち消す（解答エリアの押し出し防止）
watch(shouldCollapseForKeyboard, (collapsed) => {
  if (!collapsed) return
  if (scrollFrame !== null) cancelAnimationFrame(scrollFrame)
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = null
    if (disposed) return
    window.scrollTo(0, 0)
    const main = document.querySelector('.main-content')
    if (main) main.scrollTop = 0
  })
})

// GamePanel 解答送信 → GameManager に委譲
function handleAnswerSubmit(answer: string) {
  if (isGameInputBlocked()) return
  session.submitAnswer(answer)
}

// ResultActions もう一度プレイ → GameManager に委譲
function handleReplay() {
  session.replay()
}

// SettingsModal
const handleOpenSettings = () => {
  isSettingsOpen.value = true
}

const handleCloseSettings = () => {
  isSettingsOpen.value = false
}

const handleUpdateVolume = (level: number) => {
  settingsStore.setVolumeLevel(level)
}

// ErrorDialog
const handleErrorAction = () => {
  window.location.reload()
}

// --- クリーンアップ ---
onBeforeUnmount(() => {
  disposed = true
  if (scrollFrame !== null) cancelAnimationFrame(scrollFrame)
  window.removeEventListener('keydown', handleKeyDown)

  stopOrientationGuard()
})
</script>

<template>
  <div class="app-container">
    <!-- Header（FINISHED 中はリザルトステージに専有させるため非表示） -->
    <AppHeader
      v-show="gameStore.currentState !== GameState.FINISHED"
      @open-settings="handleOpenSettings"
    />

    <!-- Main Content Area -->
    <main class="main-content">
      <!-- Video Player（FINISHED 中は非表示。v-show で iframe を破棄せずプレイヤー状態を保持。
           hideVideoPlayerDuringAnswer=true の ANSWERING 中は visibility で隠す — 高さ保持・iframe 非破棄） -->
      <VideoPlayer
        v-if="quizData"
        v-show="gameStore.currentState !== GameState.FINISHED && !shouldCollapseForKeyboard"
        :class="{ 'player-hidden': shouldHidePlayer }"
        :video-id="quizData.videoId"
        :settings="quizData.settings"
        @ready="handlePlayerReady"
        @error="handlePlayerError"
      />

      <!-- Game UI (FINISHED以外) -->
      <template v-if="gameStore.currentState !== GameState.FINISHED">
        <!-- スコアボード（video 直下にフルブリードで密着） -->
        <GameInfo />

        <div class="game-ui">
          <GamePanel @submit="handleAnswerSubmit" />
          <!-- 動画を畳んだ分の高さを margin で補い、ボタンの画面上の位置を保つ（Task 22-1 改定） -->
          <QuizButton
            v-if="gameStore.isButtonVisible"
            :class="{ 'keyboard-offset': shouldCollapseForKeyboard }"
            :button-state="gameStore.buttonState"
            @press="handleButtonPress"
          />
        </div>
      </template>

      <!-- Result UI (FINISHED状態) -->
      <div v-else class="result-ui">
        <div class="result-content">
          <FinalScore
            :correct-count="gameStore.correctCount"
            :total-questions="gameStore.totalQuestions"
          />
          <ResultTable :results="gameStore.results" :show-user-answers="true" />
        </div>
        <ResultActions @replay="handleReplay" />
      </div>
    </main>

    <!-- Modals and Dialogs -->
    <SettingsModal
      :is-open="isSettingsOpen"
      :volume-level="settingsStore.volumeLevel"
      @close="handleCloseSettings"
      @update-volume="handleUpdateVolume"
      @open-theme-switcher="handleOpenThemeSwitcher"
    />

    <ThemeSwitcher :is-open="isThemeSwitcherOpen" @close="isThemeSwitcherOpen = false" />

    <LoadingDialog
      :is-open="gameStore.currentState === GameState.LOADING"
      message="読み込み中..."
    />

    <OrientationDialog :is-open="isOrientationOpen" />

    <ErrorDialog
      :is-open="!!initError"
      :title="initError?.title ?? 'エラーが発生しました'"
      :message="initError?.message ?? '問題が発生しました。ページを再読み込みしてください。'"
      :show-close="false"
      @action="handleErrorAction"
    />

    <PwaUpdatePrompt />

    <!-- 開始ゲート: 音声許諾 + 動画ウォームアップをユーザー操作内で行う（LOADING 中から表示） -->
    <button
      v-if="!isGateDismissed && gameStore.currentState !== GameState.FINISHED"
      type="button"
      class="start-gate"
      data-dialog-return-focus="gate"
      :disabled="gameStore.currentState !== GameState.READY"
      @click="handleGateTap"
    >
      <span class="start-gate-title">YOUTUBE <em>QUIZ BATTLE</em></span>
      <template v-if="gameStore.currentState === GameState.READY">
        <span class="start-gate-action">タップしてはじめる</span>
        <span
          class="start-gate-concept"
          :class="`start-gate-concept--${START_GATE_CONCEPT_STYLE}`"
          aria-hidden="true"
        ></span>
        <span class="start-gate-note"
          >クイズ動画を視聴しながら<br />早押しで勝負に参加することができます</span
        >
      </template>
      <span v-else class="start-gate-note">読み込み中...</span>
    </button>
  </div>
</template>

<style scoped>
/* アプリケーション全体のコンテナ */
.app-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: var(--ui-viewport-height);
  /* standalone表示などでsafe-areaが提供される場合に操作領域を保護する */
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
  /* ステージ背景: 下部に放射スポットライト + 縦方向グラデーション */
  background: var(--surface-app);
  color: var(--color-text-main);
  overflow: hidden;
}

/* Main Content（wireframe: 各セクションはフルブリードで密着・余白は game-ui のみ） */
/* 開始ゲート（フルスクリーン。タップで音声許諾 + priming） */
.start-gate {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.875rem;
  border: none;
  cursor: pointer;
  color: var(--color-text-main);
  background: var(--gate-bg);
}

.start-gate-title {
  font-size: calc(1.125 * var(--ui-font-unit));
  font-weight: 800;
  letter-spacing: 0.12em;
}

.start-gate-title em {
  font-style: normal;
  color: var(--color-accent);
}

.start-gate-action {
  font-size: calc(0.9375 * var(--ui-font-unit));
  font-weight: 700;
  color: var(--color-accent);
  margin-bottom: 0.5rem;
  animation: gate-blink 1.6s ease-in-out infinite;
}

.start-gate-note {
  font-size: calc(0.75 * var(--ui-font-unit));
  color: var(--color-text-dim);
}

.start-gate-concept {
  position: relative;
  display: block;
  width: min(50%, calc(var(--ui-viewport-height) * 0.45));
  aspect-ratio: 1;
  flex: none;
}

.start-gate-concept::before {
  position: absolute;
  inset: 0;
  content: '';
  background-color: #fff;
  -webkit-mask: url('/quiz-battle-concept-white-fill.svg') center / contain no-repeat;
  mask: url('/quiz-battle-concept-white-fill.svg') center / contain no-repeat;
}

.start-gate-concept::after {
  position: absolute;
  inset: 0;
  content: '';
  background-color: var(--color-accent);
  -webkit-mask: url('/quiz-battle-concept-mc.svg') center / contain no-repeat;
  mask: url('/quiz-battle-concept-mc.svg') center / contain no-repeat;
}

.start-gate-concept--accent-only::before {
  display: none;
}

.start-gate-concept--white-fill::before {
  display: block;
}

@keyframes gate-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

/* ANSWERING 中の動画非表示（高さ・iframe を保持したまま見えなくする） */
.player-hidden {
  visibility: hidden;
}

/* 動画を畳んだ分の高さ補填（フルブリード幅 × 9/16 + 下ボーダー 1px）。
   margin 方式なら game-ui の gap 数が変わらず、ボタン位置が正確に保たれる */
.keyboard-offset {
  margin-top: calc(100vw * 9 / 16 + 1px);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

/* Game UI（wireframe の .game-area 相当） */
.game-ui {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 0.875rem 0.75rem;
  min-height: 0;
}

/* Result UI（リザルトステージ: 上部に放射スポットライト） */
.result-ui {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.75rem 1.125rem 1.125rem;
  min-height: 0;
  background: var(--result-bg);
}

/* Result Content（タイムライン部分が内部で縦スクロールする） */
.result-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* 縦に短い画面のみ余白を詰める（上部セクションは wireframe の固定値を維持） */
@media (max-height: 640px) {
  .game-ui {
    gap: 0.625rem;
    padding: 0.625rem 0.75rem;
  }
}
</style>
