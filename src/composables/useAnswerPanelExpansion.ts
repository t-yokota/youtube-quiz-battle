import { onScopeDispose, readonly, ref, watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { GameState } from '@/types'
import { ANSWER_PANEL_RESULT_HOLD_MS } from '@/constants/timing'

/** PCカードの開閉だけを管理し、判定表示やゲーム進行には触れない。 */
export function useAnswerPanelExpansion() {
  const store = useGameStore()
  const expanded = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  function cancel() {
    clearTimeout(timer)
    timer = undefined
  }
  watch(
    () => store.currentState,
    (state, previous) => {
      if (state === GameState.ANSWERING) {
        cancel()
        expanded.value = true
      } else if ([GameState.LOADING, GameState.READY, GameState.FINISHED].includes(state)) {
        cancel()
        expanded.value = false
      } else if (previous === GameState.ANSWERING) {
        cancel()
        // 判定が同じ値（連続した不正解）でも、ANSWERINGを出るたびに維持時間を計る。
        if (store.answerResult) {
          timer = setTimeout(() => {
            expanded.value = false
            timer = undefined
          }, ANSWER_PANEL_RESULT_HOLD_MS)
        } else expanded.value = false
      }
      // WAITINGやREVEALINGへの入場だけでは再拡大・維持時間の延長をしない。
    },
    { immediate: true, flush: 'sync' },
  )
  watch(
    () => store.currentQuestionIndex,
    () => {
      cancel()
      expanded.value = store.currentState === GameState.ANSWERING
    },
    { flush: 'sync' },
  )
  onScopeDispose(cancel)
  return readonly(expanded)
}
