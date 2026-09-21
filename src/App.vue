<script setup lang="ts">
import { isIOS } from '@/utils/isIOS'
// YouTube Quiz Battle - メインアプリケーション
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import AppHeader from './components/common/AppHeader.vue'
import VideoPlayer from './components/common/VideoPlayer.vue'
import PwaUpdatePrompt from './components/common/PwaUpdatePrompt.vue'
import DesktopResizeHandles from './components/game/DesktopResizeHandles.vue'
import ScoreSidebar from './components/game/ScoreSidebar.vue'
import { useDesktopLayout } from './composables/useDesktopLayout'
import { useAnswerPanelExpansion } from './composables/useAnswerPanelExpansion'
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
import { ButtonState, GameState } from './types'
import { shouldHandleSpaceKey } from './utils/keyboardHandler'

type StartGateConceptStyle = 'accent-only' | 'white-fill'

// 白下地付きと比較する場合は 'white-fill' へ切り替える
// const START_GATE_CONCEPT_STYLE: StartGateConceptStyle = 'accent-only'
const START_GATE_CONCEPT_STYLE: StartGateConceptStyle = 'white-fill'

let disposed = false
let scrollFrame: number | null = null
const gameStore = useGameStore()
const settingsStore = useSettingsStore()
const isDesktop = useDesktopLayout()
const desktopVideoWidth = ref<number>()
const mainContent = ref<HTMLElement>()
let mainSizeObserver: ResizeObserver | undefined
onMounted(() => {
  if (!mainContent.value || typeof ResizeObserver === 'undefined') return
  // ヘッダーとsafe-areaを除いた実際の高さを初期動画幅の基準にする。
  mainSizeObserver = new ResizeObserver(([entry]) => {
    if (entry) {
      mainContent.value?.style.setProperty(
        '--desktop-content-height',
        `${entry.contentRect.height}px`,
      )
      // 手動の動画幅には連動させず、この画面での初期幅をモデル上限の基準にする。
      const initialWidth = Math.max(
        640,
        Math.min((((entry.contentRect.height * 13) / 25) * 16) / 9, entry.contentRect.width - 480),
      )
      mainContent.value?.style.setProperty('--desktop-initial-width', `${initialWidth}px`)
    }
  })
  mainSizeObserver.observe(mainContent.value)
})
const desktopButtonWidth = ref<number>()
const isPanelExpanded = useAnswerPanelExpansion()
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
  isThemeSwitcherOpen.value = true
  isSettingsOpen.value = false
}

// 画面向き検出（横画面時は External Pause で一時停止し、ダイアログを表示）
const { isLandscape: isOrientationOpen, stop: stopOrientationGuard } = useOrientationGuard(
  session.pauseForOrientation,
  session.resumeForOrientation,
)

// 同期監視でも設定→テーマ切替中に停止を解除しないよう、開く順序を揃える。
watch(() => isSettingsOpen.value || isThemeSwitcherOpen.value, session.setSettingsOpen, {
  flush: 'sync',
})
if (isOrientationOpen.value) session.pauseForOrientation()

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
  if (
    gameStore.currentState === GameState.QUESTIONING &&
    gameStore.isButtonEnabled &&
    gameStore.effectiveSettings?.hideVideoPlayerDuringAnswer
  ) {
    // iOSの同期focusでキーボードが開く前の高さを保存する。
    beforeAnswerButtonHeight = measureButtonHeight()
  }
  // iOSではユーザー操作内の同期focusでキーボードを開く。
  if (isIOS() && gameStore.currentState === GameState.QUESTIONING && gameStore.isButtonEnabled) {
    const input = document.querySelector<HTMLInputElement>('.answer-input')
    if (input) {
      input.disabled = false
      input.focus({ preventScroll: true })
    }
  }
  // その他の端末は演出待ち後のANSWERING遷移に合わせてフォーカスする。
  session.pressButton()
}

// スペースキー早押し（グローバルキーボードハンドラ）
const quizButton = ref<InstanceType<typeof QuizButton>>()
function handleKeyDown(e: KeyboardEvent) {
  if (isGameInputBlocked() || !shouldHandleSpaceKey(e)) return
  e.preventDefault() // スペースキーによるページスクロールを抑止
  quizButton.value?.activate()
}

async function releasePlayControlFocus(event: MouseEvent) {
  const control = event.target instanceof Element ? event.target.closest('button') : null
  if (!control) return
  // 子のclick.stopより前に操作元を記録し、処理完了後にだけ解除する。
  // Spaceがアイコン等の再操作になるのを防ぎつつ、押下処理が解答欄へ
  // 移したフォーカス（特にiOSの同期focus）は奪わない。設定ダイアログは対象外。
  await nextTick()
  if (document.activeElement === control) control.blur()
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

// ANSWERING中はiframeを保持したまま解答中表示に置き換える。
const shouldHidePlayer = computed(
  () =>
    (gameStore.effectiveSettings?.hideVideoPlayerDuringAnswer ?? false) &&
    gameStore.currentState === GameState.ANSWERING,
)

const gameUi = ref<HTMLElement>()
const answerButtonHeight = ref<string>()
let beforeAnswerButtonHeight: number | undefined
function measureButtonHeight() {
  const height = gameUi.value
    ?.querySelector('.quiz-button-container')
    ?.getBoundingClientRect().height
  return height && height > 0 ? height : undefined
}
watch(
  [shouldHidePlayer, () => gameStore.currentState],
  ([hidden, state], [wasHidden]) => {
    if (hidden && !wasHidden) {
      // 領域を最低高へ縮めると3Dモデルも縮小されるため、実測した高さを保持する。
      const height = beforeAnswerButtonHeight ?? measureButtonHeight()
      answerButtonHeight.value = height ? `${height}px` : undefined
      beforeAnswerButtonHeight = undefined
    } else if (!hidden) {
      answerButtonHeight.value = undefined
      if (state !== GameState.QUESTIONING) beforeAnswerButtonHeight = undefined
    }
  },
  { flush: 'sync' },
)

// タッチデバイス判定（初回評価のみ。useOrientationGuard と同じ基準）
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches

// タッチデバイスの ANSWERING 中は動画領域を畳み、
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

const handleCloseSettings = async () => {
  isSettingsOpen.value = false
  // モーダルの背景遮断解除・通常のフォーカス復帰を待ってから、
  // 次のゲーム操作へ移す。設定ボタンに戻すとSpaceで設定を再度開いてしまう。
  await nextTick()
  if (isGameInputBlocked()) return
  const area = gameUi.value
  const target =
    gameStore.currentState === GameState.ANSWERING
      ? area?.querySelector<HTMLElement>('.answer-input:not(:disabled)')
      : (area?.querySelector<HTMLElement>('.button-hit:not(:disabled)') ??
        area?.querySelector<HTMLElement>('.quiz-button:not(:disabled)'))
  if (target && !target.closest('[inert]')) target.focus({ preventScroll: true })
  else area?.focus({ preventScroll: true })
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
  mainSizeObserver?.disconnect()
  if (scrollFrame !== null) cancelAnimationFrame(scrollFrame)
  window.removeEventListener('keydown', handleKeyDown)

  stopOrientationGuard()
})
</script>

<template>
  <div class="app-container">
    <!-- PCは終了後も右サイドの結果一覧とプレイレイアウトを維持する。 -->
    <AppHeader
      v-show="isDesktop || gameStore.currentState !== GameState.FINISHED"
      @open-settings="handleOpenSettings"
    />

    <!-- Main Content Area -->
    <main
      ref="mainContent"
      class="main-content"
      @click.capture="releasePlayControlFocus"
      :style="{
        '--desktop-preferred-width': desktopVideoWidth ? `${desktopVideoWidth}px` : undefined,
      }"
      :class="{
        'desktop-layout': isDesktop,
      }"
    >
      <!-- Video Player（スマホのFINISHED中は非表示。v-showでiframeを保持。
           解答中の置換表示でも高さとiframeを保持する） -->
      <VideoPlayer
        v-if="quizData"
        v-show="
          (isDesktop || gameStore.currentState !== GameState.FINISHED) && !shouldCollapseForKeyboard
        "
        :answering="shouldHidePlayer"
        :video-id="quizData.videoId"
        :settings="quizData.settings"
        @ready="handlePlayerReady"
        @error="handlePlayerError"
      />

      <DesktopResizeHandles v-if="isDesktop" @resize="desktopVideoWidth = $event" />
      <!-- PCはFINISHEDもここに表示し、解答カードを再プレイボタンに置き換える。 -->
      <template v-if="isDesktop || gameStore.currentState !== GameState.FINISHED">
        <!-- スコアボード（video 直下にフルブリードで密着） -->
        <GameInfo v-if="!isDesktop" />
        <ScoreSidebar v-else />

        <div
          ref="gameUi"
          tabindex="-1"
          class="game-ui"
          :class="{
            'answering-player-hidden': shouldHidePlayer && !isDesktop,
            'panel-expanded': isDesktop && isPanelExpanded,
          }"
          :style="{
            '--answer-button-height': answerButtonHeight,
            '--desktop-button-width': desktopButtonWidth ? `${desktopButtonWidth}px` : undefined,
          }"
        >
          <GamePanel
            :desktop="isDesktop"
            :compact="isDesktop && !isPanelExpanded"
            :focus-blocked="isGameInputBlocked()"
            @submit="handleAnswerSubmit"
            @replay="handleReplay"
          />
          <!-- 動画非表示時も解答エリア直下にボタンを配置する。 -->
          <QuizButton
            ref="quizButton"
            v-if="
              gameStore.isButtonVisible ||
              (isDesktop && gameStore.currentState === GameState.FINISHED)
            "
            :desktop="isDesktop"
            :panel-expanded="isDesktop && isPanelExpanded"
            :button-state="
              gameStore.currentState === GameState.FINISHED
                ? ButtonState.DISABLED
                : gameStore.buttonState
            "
            :interaction-blocked="isGameInputBlocked()"
            @press="handleButtonPress"
            @visual-width="desktopButtonWidth = $event"
          />
        </div>
      </template>

      <!-- スマホのResult UI (FINISHED状態) -->
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
  -webkit-mask: url('/assets/images/quiz-battle-concept-fill-white.svg') center / contain no-repeat;
  mask: url('/assets/images/quiz-battle-concept-fill-white.svg') center / contain no-repeat;
}

.start-gate-concept::after {
  position: absolute;
  inset: 0;
  content: '';
  background-color: var(--color-accent);
  -webkit-mask: url('/assets/images/quiz-battle-concept-line.svg') center / contain no-repeat;
  mask: url('/assets/images/quiz-battle-concept-line.svg') center / contain no-repeat;
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
  --game-ui-padding-block: 0.875rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: var(--game-ui-padding-block) 0.75rem;
  min-height: 0;
}

/* 動画非表示中は解答エリアを基準に固定配置する。
   キーボードによる残り高さの変化を、ボタンの位置・大きさに反映しない。 */
.game-ui.answering-player-hidden {
  gap: 0.875rem;
}
.game-ui.answering-player-hidden :deep(.quiz-button-container) {
  flex: 0 0 var(--answer-button-height, 13.5rem);
  height: var(--answer-button-height, 13.5rem);
  min-height: var(--answer-button-height, 13.5rem);
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
    --game-ui-padding-block: 0.625rem;
    gap: 0.625rem;
    padding: var(--game-ui-padding-block) 0.75rem;
  }
}
</style>

<style src="./assets/desktop.css"></style>
